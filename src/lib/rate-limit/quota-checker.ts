/**
 * Quota enforcement system
 * Checks token usage against daily/monthly limits
 */

import { kv } from '@vercel/kv';
import { db } from '@/lib/db';
import { usageAggregates } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import type { ApiKey } from '@/lib/db/schema';
import type { RateLimitResult } from '@/types';

const QUOTA_CACHE_TTL = 60; // Cache quota status for 60 seconds

/**
 * Check if API key has exceeded token quota
 */
export async function checkQuota(apiKey: ApiKey): Promise<RateLimitResult> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // Try to get cached quota status
    const cacheKey = `quota:${apiKey.id}:day:${today}`;
    const cached = await kv.get<{ tokensUsed: number; allowed: boolean }>(cacheKey);

    let tokensUsed: number;

    if (cached) {
      tokensUsed = cached.tokensUsed;
    } else {
      // Query database for today's usage
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);

      const [aggregate] = await db
        .select({
          totalTokensInput: usageAggregates.totalTokensInput,
          totalTokensOutput: usageAggregates.totalTokensOutput,
        })
        .from(usageAggregates)
        .where(
          and(
            eq(usageAggregates.apiKeyId, apiKey.id),
            eq(usageAggregates.period, 'day'),
            gte(usageAggregates.periodStart, todayStart)
          )
        )
        .limit(1);

      tokensUsed = aggregate
        ? Number(aggregate.totalTokensInput) + Number(aggregate.totalTokensOutput)
        : 0;

      // Cache the result
      await kv.set(cacheKey, { tokensUsed, allowed: true }, { ex: QUOTA_CACHE_TTL });
    }

    // Check against daily token limit
    const dailyLimit = apiKey.tokensPerDay ? Number(apiKey.tokensPerDay) : 1000000;

    if (tokensUsed >= dailyLimit) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const resetTime = tomorrow.getTime();
      const retryAfter = Math.ceil((resetTime - now.getTime()) / 1000);

      return {
        allowed: false,
        limit: dailyLimit,
        remaining: 0,
        reset: Math.floor(resetTime / 1000),
        retryAfter,
      };
    }

    return {
      allowed: true,
      limit: dailyLimit,
      remaining: dailyLimit - tokensUsed,
    };
  } catch (error) {
    console.error('Quota check error:', error);
    // Fail open: allow request if check fails
    return {
      allowed: true,
    };
  }
}

/**
 * Increment token usage in cache (for real-time tracking)
 * This is called after a request completes
 */
export async function incrementTokenUsage(
  apiKeyId: string,
  tokensInput: number,
  tokensOutput: number
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `quota:${apiKeyId}:day:${today}`;

  try {
    const cached = await kv.get<{ tokensUsed: number; allowed: boolean }>(cacheKey);

    if (cached) {
      const newTotal = cached.tokensUsed + tokensInput + tokensOutput;
      await kv.set(cacheKey, { tokensUsed: newTotal, allowed: true }, { ex: QUOTA_CACHE_TTL });
    }
  } catch (error) {
    console.error('Error incrementing token usage:', error);
    // Non-critical error - continue
  }
}

/**
 * Create quota exceeded error response
 */
export function createQuotaExceededResponse(result: RateLimitResult): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (result.reset !== undefined) {
    headers.set('X-Quota-Reset', result.reset.toString());
  }
  if (result.retryAfter !== undefined) {
    headers.set('Retry-After', result.retryAfter.toString());
  }

  return new Response(
    JSON.stringify({
      error: {
        type: 'quota_exceeded',
        message: 'Daily token quota exceeded. Please try again tomorrow.',
      },
    }),
    {
      status: 429,
      headers,
    }
  );
}

/**
 * Get remaining quota for an API key
 * Used for dashboard display
 */
export async function getRemainingQuota(apiKey: ApiKey): Promise<{
  requestsPerMinute: number | null;
  requestsPerDay: number | null;
  tokensPerDay: number | null;
}> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentMinute = Math.floor(now.getTime() / 60000);

  try {
    // Get minute requests
    const minuteKey = `rate_limit:${apiKey.id}:minute:${currentMinute}`;
    const minuteCount = (await kv.get<number>(minuteKey)) || 0;

    // Get day requests
    const dayKey = `rate_limit:${apiKey.id}:day:${today}`;
    const dayCount = (await kv.get<number>(dayKey)) || 0;

    // Get token usage from cache or DB
    const cacheKey = `quota:${apiKey.id}:day:${today}`;
    const cached = await kv.get<{ tokensUsed: number }>(cacheKey);
    const tokensUsed = cached?.tokensUsed || 0;

    return {
      requestsPerMinute: apiKey.requestsPerMinute
        ? Math.max(0, apiKey.requestsPerMinute - minuteCount)
        : null,
      requestsPerDay: apiKey.requestsPerDay
        ? Math.max(0, apiKey.requestsPerDay - dayCount)
        : null,
      tokensPerDay: apiKey.tokensPerDay
        ? Math.max(0, Number(apiKey.tokensPerDay) - tokensUsed)
        : null,
    };
  } catch (error) {
    console.error('Error getting remaining quota:', error);
    return {
      requestsPerMinute: apiKey.requestsPerMinute,
      requestsPerDay: apiKey.requestsPerDay,
      tokensPerDay: apiKey.tokensPerDay ? Number(apiKey.tokensPerDay) : null,
    };
  }
}
