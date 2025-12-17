import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usageLogs, usageAggregates, apiKeys } from '@/lib/db/schema';
import { sql, gte, lt, and, eq } from 'drizzle-orm';

// Vercel Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/aggregate-usage
 * Aggregates usage logs into hourly, daily, and monthly summaries
 *
 * This endpoint should be called by a cron job (e.g., every hour)
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/aggregate-usage",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if configured
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const now = new Date();
    const results = {
      hourly: 0,
      daily: 0,
      monthly: 0,
    };

    // Get all active API keys
    const activeKeys = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.isActive, true));

    for (const key of activeKeys) {
      // Aggregate hourly (last 2 hours to catch any missed data)
      const hourlyResult = await aggregatePeriod(key.id, 'hour', now, 2);
      results.hourly += hourlyResult;

      // Aggregate daily (current day)
      const dailyResult = await aggregatePeriod(key.id, 'day', now, 1);
      results.daily += dailyResult;

      // Aggregate monthly (current month)
      const monthlyResult = await aggregatePeriod(key.id, 'month', now, 1);
      results.monthly += monthlyResult;
    }

    return NextResponse.json({
      success: true,
      message: 'Usage aggregation completed',
      results,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Error aggregating usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to aggregate usage data' },
      { status: 500 }
    );
  }
}

/**
 * Aggregate usage data for a specific period
 */
async function aggregatePeriod(
  apiKeyId: string,
  period: 'hour' | 'day' | 'month',
  now: Date,
  lookbackPeriods: number
): Promise<number> {
  let aggregated = 0;

  for (let i = 0; i < lookbackPeriods; i++) {
    const { start, end } = getPeriodBounds(period, now, i);

    // Query raw usage logs for this period
    const [stats] = await db
      .select({
        totalRequests: sql<number>`count(*)`,
        successfulRequests: sql<number>`count(*) filter (where status_code between 200 and 299)`,
        failedRequests: sql<number>`count(*) filter (where status_code >= 400)`,
        totalTokensInput: sql<number>`coalesce(sum(tokens_input), 0)`,
        totalTokensOutput: sql<number>`coalesce(sum(tokens_output), 0)`,
        totalCostUsd: sql<number>`coalesce(sum(cost_usd), 0)`,
      })
      .from(usageLogs)
      .where(
        and(
          eq(usageLogs.apiKeyId, apiKeyId),
          gte(usageLogs.timestamp, start),
          lt(usageLogs.timestamp, end)
        )
      );

    // Get model breakdown
    const modelStats = await db
      .select({
        model: usageLogs.model,
        requests: sql<number>`count(*)`,
        tokens: sql<number>`sum(tokens_input + tokens_output)`,
      })
      .from(usageLogs)
      .where(
        and(
          eq(usageLogs.apiKeyId, apiKeyId),
          gte(usageLogs.timestamp, start),
          lt(usageLogs.timestamp, end)
        )
      )
      .groupBy(usageLogs.model);

    const modelBreakdown: Record<string, { requests: number; tokens: number }> = {};
    for (const ms of modelStats) {
      if (ms.model) {
        modelBreakdown[ms.model] = {
          requests: Number(ms.requests) || 0,
          tokens: Number(ms.tokens) || 0,
        };
      }
    }

    // Only insert if there's data
    if (stats && stats.totalRequests > 0) {
      // Upsert the aggregate
      await db
        .insert(usageAggregates)
        .values({
          apiKeyId,
          period,
          periodStart: start,
          totalRequests: Number(stats.totalRequests) || 0,
          successfulRequests: Number(stats.successfulRequests) || 0,
          failedRequests: Number(stats.failedRequests) || 0,
          totalTokensInput: Number(stats.totalTokensInput) || 0,
          totalTokensOutput: Number(stats.totalTokensOutput) || 0,
          totalCostUsd: Number(stats.totalCostUsd) || 0,
          modelBreakdown,
        })
        .onConflictDoUpdate({
          target: [usageAggregates.apiKeyId, usageAggregates.period, usageAggregates.periodStart],
          set: {
            totalRequests: Number(stats.totalRequests) || 0,
            successfulRequests: Number(stats.successfulRequests) || 0,
            failedRequests: Number(stats.failedRequests) || 0,
            totalTokensInput: Number(stats.totalTokensInput) || 0,
            totalTokensOutput: Number(stats.totalTokensOutput) || 0,
            totalCostUsd: Number(stats.totalCostUsd) || 0,
            modelBreakdown,
            updatedAt: new Date(),
          },
        });

      aggregated++;
    }
  }

  return aggregated;
}

/**
 * Get the start and end timestamps for a period
 */
function getPeriodBounds(
  period: 'hour' | 'day' | 'month',
  now: Date,
  offset: number
): { start: Date; end: Date } {
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case 'hour':
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() - offset);
      end.setTime(start.getTime() + 60 * 60 * 1000);
      break;

    case 'day':
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - offset);
      end.setTime(start.getTime() + 24 * 60 * 60 * 1000);
      break;

    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      start.setMonth(start.getMonth() - offset);
      end.setMonth(start.getMonth() + 1);
      break;
  }

  return { start, end };
}

// Also support GET for manual triggering (with auth)
export async function GET(request: NextRequest) {
  // Forward to POST handler
  return POST(request);
}
