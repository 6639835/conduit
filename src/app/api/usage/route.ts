import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usageLogs } from '@/lib/db/schema';
import { hashApiKey } from '@/lib/auth/api-key';
import { getRemainingQuota } from '@/lib/rate-limit/quota-checker';
import { eq, and, gte, sql } from 'drizzle-orm';
import type { UsageResponse } from '@/types';

// Configure edge runtime
export const runtime = 'edge';

/**
 * GET /api/usage?key=sk-cond_xxx
 * Public endpoint for users to view their usage (no authentication required)
 */
export async function GET(request: NextRequest) {
  try {
    // Get API key from query params
    const searchParams = request.nextUrl.searchParams;
    const apiKeyParam = searchParams.get('key');

    if (!apiKeyParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing API key parameter',
        } as UsageResponse,
        { status: 400 }
      );
    }

    // Hash the provided key and look up
    const keyHash = await hashApiKey(apiKeyParam);

    const [apiKey] = await db.query.apiKeys.findMany({
      where: (keys, { eq }) => eq(keys.keyHash, keyHash),
      limit: 1,
    });

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key',
        } as UsageResponse,
        { status: 404 }
      );
    }

    // Get date range (default: last 30 days)
    const startDate = searchParams.get('startDate');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dateFilter = startDate
      ? gte(usageLogs.timestamp, new Date(startDate))
      : gte(usageLogs.timestamp, thirtyDaysAgo);

    // Query usage logs for statistics
    const usageData = await db
      .select({
        totalRequests: sql<number>`count(*)`,
        successfulRequests: sql<number>`count(*) filter (where ${usageLogs.statusCode} < 400)`,
        failedRequests: sql<number>`count(*) filter (where ${usageLogs.statusCode} >= 400)`,
        totalTokensInput: sql<number>`coalesce(sum(${usageLogs.tokensInput}), 0)`,
        totalTokensOutput: sql<number>`coalesce(sum(${usageLogs.tokensOutput}), 0)`,
        totalCostUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      })
      .from(usageLogs)
      .where(and(eq(usageLogs.apiKeyId, apiKey.id), dateFilter))
      .execute();

    // Query model breakdown
    const modelData = await db
      .select({
        model: usageLogs.model,
        requests: sql<number>`count(*)`,
        tokensInput: sql<number>`coalesce(sum(${usageLogs.tokensInput}), 0)`,
        tokensOutput: sql<number>`coalesce(sum(${usageLogs.tokensOutput}), 0)`,
        costUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      })
      .from(usageLogs)
      .where(and(eq(usageLogs.apiKeyId, apiKey.id), dateFilter))
      .groupBy(usageLogs.model)
      .execute();

    // Build model breakdown object
    const modelBreakdown: Record<string, {
      requests: number;
      tokensInput: number;
      tokensOutput: number;
      costUsd: number;
    }> = {};
    for (const row of modelData) {
      modelBreakdown[row.model] = {
        requests: row.requests,
        tokensInput: row.tokensInput,
        tokensOutput: row.tokensOutput,
        costUsd: row.costUsd,
      };
    }

    // Get remaining quota
    const quotaRemaining = await getRemainingQuota(apiKey);

    const stats = usageData[0];

    return NextResponse.json(
      {
        success: true,
        usage: {
          totalRequests: stats.totalRequests,
          successfulRequests: stats.successfulRequests,
          failedRequests: stats.failedRequests,
          totalTokensInput: stats.totalTokensInput,
          totalTokensOutput: stats.totalTokensOutput,
          totalCostUsd: stats.totalCostUsd,
          modelBreakdown,
          quotaRemaining,
        },
      } as UsageResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch usage data',
      } as UsageResponse,
      { status: 500 }
    );
  }
}
