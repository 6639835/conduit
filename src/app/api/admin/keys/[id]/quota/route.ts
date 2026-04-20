import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, usageAggregates, usageLogs } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { apiKeyAccessCondition } from '@/lib/auth/api-key-access';
import { kv } from '@vercel/kv';

interface QuotaUsageResponse {
  success: boolean;
  quota?: {
    requestsPerMinute: {
      used: number;
      limit: number;
      remaining: number;
      percentage: number;
    };
    requestsPerDay: {
      used: number;
      limit: number;
      remaining: number;
      percentage: number;
    };
    tokensPerDay: {
      used: number;
      limit: number;
      remaining: number;
      percentage: number;
    };
    monthlySpend?: {
      used: number;
      limit: number;
      remaining: number;
      percentage: number;
    };
  };
  error?: string;
}

/**
 * GET /api/admin/keys/[id]/quota - Get current quota usage for an API key
 * Requires authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_READ);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;

    // Get the API key
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(apiKeyAccessCondition(id, authResult.adminContext))
      .limit(1);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        } as QuotaUsageResponse,
        { status: 404 }
      );
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const currentMinute = Math.floor(now.getTime() / 60000);

    // Get requests per minute from cache
    const minuteKey = `rate_limit:${apiKey.id}:minute:${currentMinute}`;
    const minuteCount = (await kv.get<number>(minuteKey)) || 0;
    const requestsPerMinuteLimit = apiKey.requestsPerMinute || 60;
    const requestsPerMinuteRemaining = Math.max(0, requestsPerMinuteLimit - minuteCount);

    // Get requests per day from cache
    const dayKey = `rate_limit:${apiKey.id}:day:${today}`;
    const dayCount = (await kv.get<number>(dayKey)) || 0;
    const requestsPerDayLimit = apiKey.requestsPerDay || 1000;
    const requestsPerDayRemaining = Math.max(0, requestsPerDayLimit - dayCount);

    // Get token usage from cache (with database fallback)
    const tokensCacheKey = `quota:${apiKey.id}:day:${today}:tokens`;
    let tokensUsed = (await kv.get<number>(tokensCacheKey)) || 0;

    // If not in cache, query database
    if (tokensUsed === 0) {
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

      if (aggregate) {
        tokensUsed = Number(aggregate.totalTokensInput) + Number(aggregate.totalTokensOutput);
        // Update cache
        await kv.set(tokensCacheKey, tokensUsed, { ex: 60 });
      }
    }

    const tokensPerDayLimit = apiKey.tokensPerDay ? Number(apiKey.tokensPerDay) : 1000000;
    const tokensPerDayRemaining = Math.max(0, tokensPerDayLimit - tokensUsed);

    // Build base response
    const response: QuotaUsageResponse = {
      success: true,
      quota: {
        requestsPerMinute: {
          used: minuteCount,
          limit: requestsPerMinuteLimit,
          remaining: requestsPerMinuteRemaining,
          percentage: (minuteCount / requestsPerMinuteLimit) * 100,
        },
        requestsPerDay: {
          used: dayCount,
          limit: requestsPerDayLimit,
          remaining: requestsPerDayRemaining,
          percentage: (dayCount / requestsPerDayLimit) * 100,
        },
        tokensPerDay: {
          used: tokensUsed,
          limit: tokensPerDayLimit,
          remaining: tokensPerDayRemaining,
          percentage: (tokensUsed / tokensPerDayLimit) * 100,
        },
      },
    };

    // Get monthly spend if limit is set
    if (apiKey.monthlySpendLimitUsd && apiKey.monthlySpendLimitUsd > 0) {
      const monthCacheKey = `quota:${apiKey.id}:month:${currentMonth}:spend_cents`;
      let monthlySpendCents = 0;

      // Try cache first
      const cachedSpendCents = await kv.get<number>(monthCacheKey);
      if (cachedSpendCents !== null && cachedSpendCents !== undefined) {
        monthlySpendCents = cachedSpendCents;
      } else {
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        const ttlSeconds = Math.max(60, Math.ceil((nextMonth.getTime() - now.getTime()) / 1000) + 86400);

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

      const monthlySpendLimit = apiKey.monthlySpendLimitUsd;
      const monthlySpend = monthlySpendCents / 100;
      const monthlySpendRemaining = Math.max(0, monthlySpendLimit - monthlySpend);

      response.quota!.monthlySpend = {
        used: monthlySpend,
        limit: monthlySpendLimit,
        remaining: monthlySpendRemaining,
        percentage: (monthlySpend / monthlySpendLimit) * 100,
      };
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error getting quota usage:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get quota usage',
      } as QuotaUsageResponse,
      { status: 500 }
    );
  }
}
