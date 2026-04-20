/**
 * Quota enforcement system
 * Checks token usage against daily/monthly limits
 */

import { kv } from '@vercel/kv';
import { db } from '@/lib/db';
import { usageAggregates, usageLogs } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import type { ApiKey } from '@/lib/db/schema';
import type { RateLimitResult } from '@/types';
import { SystemNotifications } from '@/lib/notifications';
import { calculateCost } from '@/lib/analytics/cost-calculator';

const QUOTA_CACHE_TTL = 60; // Cache quota status for 60 seconds

function shouldFailOpen(): boolean {
  // Default: fail-open in non-production to avoid blocking development.
  // In production, require explicit opt-in to fail-open.
  return process.env.NODE_ENV !== 'production' || process.env.LIMITER_FAIL_OPEN === 'true';
}

function getMonthBounds(now: Date): { monthStart: Date; nextMonth: Date; ttlSeconds: number } {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const ttlSeconds = Math.max(60, Math.ceil((nextMonth.getTime() - now.getTime()) / 1000) + 86400);

  return { monthStart, nextMonth, ttlSeconds };
}

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
      const monthCacheKey = `quota:${apiKey.id}:month:${currentMonth}:spend_cents`;
      const cachedSpendCents = await kv.get<number>(monthCacheKey);

      let monthlySpendCents: number;
      const { monthStart, nextMonth, ttlSeconds } = getMonthBounds(now);

      if (cachedSpendCents !== null && cachedSpendCents !== undefined) {
        monthlySpendCents = cachedSpendCents;
      } else {
        // Seed the real-time counter from raw logs so monthly limits do not wait for aggregation cron.
        const [monthUsage] = await db
          .select({
            totalCostCents: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
          })
          .from(usageLogs)
          .where(
            and(
              eq(usageLogs.apiKeyId, apiKey.id),
              gte(usageLogs.timestamp, monthStart)
            )
          );

        monthlySpendCents = Number(monthUsage?.totalCostCents) || 0;

        await kv.set(monthCacheKey, monthlySpendCents, { ex: ttlSeconds });
      }

      // Calculate spend percentage and send warnings (await to handle errors properly)
      const monthlySpendLimitCents = apiKey.monthlySpendLimitUsd * 100;
      const spendPercent = (monthlySpendCents / monthlySpendLimitCents) * 100;
      try {
        await sendSpendLimitWarning(apiKey, spendPercent);
      } catch (error) {
        console.error('Failed to send spend limit warning:', error);
      }

      // Check if monthly spend limit exceeded
      const resetTime = nextMonth.getTime();
      const retryAfter = Math.ceil((resetTime - now.getTime()) / 1000);

      if (monthlySpendCents >= monthlySpendLimitCents) {
        return {
          allowed: false,
          limit: apiKey.monthlySpendLimitUsd,
          remaining: 0,
          reset: Math.floor(resetTime / 1000),
          retryAfter,
        };
      }
    }

    // Try to get cached token count (using atomic counter key)
    const tokensCacheKey = `quota:${apiKey.id}:day:${today}:tokens`;
    const cachedTokens = await kv.get<number>(tokensCacheKey);

    let tokensUsed: number;

    if (cachedTokens !== null && cachedTokens !== undefined) {
      tokensUsed = cachedTokens;
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

      // Cache the result using atomic counter
      await kv.set(tokensCacheKey, tokensUsed, { ex: QUOTA_CACHE_TTL });
    }

    // Check against daily token limit
    const dailyLimit = apiKey.tokensPerDay ? Number(apiKey.tokensPerDay) : 1000000;

    // Calculate usage percentage and send warnings (await to handle errors properly)
    const usagePercent = (tokensUsed / dailyLimit) * 100;
    try {
      await sendQuotaWarning(apiKey, usagePercent);
    } catch (error) {
      console.error('Failed to send quota warning:', error);
    }

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
    if (shouldFailOpen()) {
      return { allowed: true };
    }

    // Fail closed when the limiter is unavailable in production.
    // The response helper will translate this into a 503.
    return {
      allowed: false,
      retryAfter: 1,
      reset: Math.floor((Date.now() + 60_000) / 1000),
    };
  }
}

/**
 * Increment token usage in cache (for real-time tracking)
 * This is called after a request completes
 * Uses atomic increment to avoid race conditions
 */
export async function incrementTokenUsage(
  apiKeyId: string,
  tokensInput: number,
  tokensOutput: number,
  model?: string
): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentMonth = now.toISOString().slice(0, 7);
  const cacheKey = `quota:${apiKeyId}:day:${today}:tokens`;
  const monthSpendKey = `quota:${apiKeyId}:month:${currentMonth}:spend_cents`;

  try {
    const totalTokens = tokensInput + tokensOutput;

    // Use atomic INCRBY to avoid race conditions
    await kv.incrby(cacheKey, totalTokens);

    // Set expiry (idempotent - only sets if no TTL exists)
    await kv.expire(cacheKey, 86400 * 2); // 2 days TTL

    if (model) {
      const costCents = calculateCost(model, tokensInput, tokensOutput);
      if (costCents > 0) {
        await kv.incrby(monthSpendKey, costCents);
        await kv.expire(monthSpendKey, getMonthBounds(now).ttlSeconds);
      }
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

  if (result.limit === undefined) {
    return new Response(
      JSON.stringify({
        error: {
          type: 'quota_unavailable',
          message: 'Quota enforcement is temporarily unavailable. Please try again shortly.',
        },
      }),
      {
        status: 503,
        headers,
      }
    );
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

    // Get token usage from atomic counter cache
    const tokensCacheKey = `quota:${apiKey.id}:day:${today}:tokens`;
    const tokensUsed = (await kv.get<number>(tokensCacheKey)) || 0;

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
