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
import { SystemNotifications } from '@/lib/notifications';

const QUOTA_CACHE_TTL = 60; // Cache quota status for 60 seconds

/**
 * Send quota warning notification if usage crosses threshold
 * Sends at 80% and 90% thresholds
 */
async function sendQuotaWarning(
  apiKey: ApiKey,
  usagePercent: number
): Promise<void> {
  // Only send notifications at specific thresholds
  const threshold = usagePercent >= 90 ? 90 : usagePercent >= 80 ? 80 : null;
  if (!threshold) return;

  // Check if we've already sent this threshold notification today
  const today = new Date().toISOString().slice(0, 10);
  const notificationKey = `quota-notification:${apiKey.id}:${today}:${threshold}`;

  try {
    const alreadySent = await kv.get(notificationKey);
    if (alreadySent) return;

    // Send notification to API key owner
    if (apiKey.createdBy) {
      await SystemNotifications.apiKeyQuotaWarning(
        apiKey.createdBy,
        apiKey.keyPrefix,
        threshold
      );

      // Mark as sent to avoid duplicate notifications
      await kv.set(notificationKey, true, { ex: 86400 }); // Expire in 24 hours
    }
  } catch (error) {
    console.error('Failed to send quota warning notification:', error);
  }
}

/**
 * Send monthly spend limit notification
 */
async function sendSpendLimitWarning(
  apiKey: ApiKey,
  spendPercent: number
): Promise<void> {
  // Only send at 90% threshold and when limit is reached
  if (spendPercent < 90) return;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const notificationKey = `spend-notification:${apiKey.id}:${currentMonth}:${spendPercent >= 100 ? 'reached' : '90'}`;

  try {
    const alreadySent = await kv.get(notificationKey);
    if (alreadySent) return;

    if (apiKey.createdBy && apiKey.monthlySpendLimitUsd) {
      if (spendPercent >= 100) {
        // Limit reached
        await SystemNotifications.spendLimitReached(
          apiKey.createdBy,
          apiKey.keyPrefix,
          apiKey.monthlySpendLimitUsd
        );
      } else {
        // 90% warning
        await SystemNotifications.apiKeyQuotaWarning(
          apiKey.createdBy,
          apiKey.keyPrefix,
          90
        );
      }

      await kv.set(notificationKey, true, { ex: 2592000 }); // Expire in 30 days
    }
  } catch (error) {
    console.error('Failed to send spend limit warning:', error);
  }
}

/**
 * Check if API key has exceeded token quota or monthly spend limit
 */
export async function checkQuota(apiKey: ApiKey): Promise<RateLimitResult> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

  try {
    // Check monthly spend limit first (if set)
    if (apiKey.monthlySpendLimitUsd && apiKey.monthlySpendLimitUsd > 0) {
      const monthCacheKey = `quota:${apiKey.id}:month:${currentMonth}:spend`;
      const cachedSpend = await kv.get<{ costUsd: number }>(monthCacheKey);

      let monthlySpend: number;
      const monthStart = new Date(currentMonth + '-01');
      monthStart.setHours(0, 0, 0, 0);

      if (cachedSpend) {
        monthlySpend = cachedSpend.costUsd;
      } else {
        // Query database for this month's spending
        const [monthAggregate] = await db
          .select({
            totalCostUsd: usageAggregates.totalCostUsd,
          })
          .from(usageAggregates)
          .where(
            and(
              eq(usageAggregates.apiKeyId, apiKey.id),
              eq(usageAggregates.period, 'month'),
              gte(usageAggregates.periodStart, monthStart)
            )
          )
          .limit(1);

        monthlySpend = monthAggregate ? Number(monthAggregate.totalCostUsd) / 100 : 0; // Convert from cents to USD

        // Cache the result
        await kv.set(monthCacheKey, { costUsd: monthlySpend }, { ex: QUOTA_CACHE_TTL });
      }

      // Calculate spend percentage and send warnings
      const spendPercent = (monthlySpend / apiKey.monthlySpendLimitUsd) * 100;
      await sendSpendLimitWarning(apiKey, spendPercent);

      // Check if monthly spend limit exceeded
      if (monthlySpend >= apiKey.monthlySpendLimitUsd) {
        const nextMonth = new Date(monthStart);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const resetTime = nextMonth.getTime();
        const retryAfter = Math.ceil((resetTime - now.getTime()) / 1000);

        return {
          allowed: false,
          limit: apiKey.monthlySpendLimitUsd,
          remaining: 0,
          reset: Math.floor(resetTime / 1000),
          retryAfter,
        };
      }
    }

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

    // Calculate usage percentage and send warnings
    const usagePercent = (tokensUsed / dailyLimit) * 100;
    await sendQuotaWarning(apiKey, usagePercent);

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
