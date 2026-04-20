import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usageLogs, apiKeys } from '@/lib/db/schema';
import { eq, gte, sql, desc } from 'drizzle-orm';
import { checkAuth } from '@/lib/auth/middleware';
import { Role } from '@/lib/auth/rbac';

interface AnalyticsResponse {
  success: boolean;
  error?: string;
  analytics?: {
    overview: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      totalTokensInput: number;
      totalTokensOutput: number;
      totalCostUsd: number;
      totalApiKeys: number;
      activeApiKeys: number;
    };
    modelBreakdown: Record<string, {
      requests: number;
      tokensInput: number;
      tokensOutput: number;
      costUsd: number;
    }>;
    topApiKeys: Array<{
      id: string;
      keyPrefix: string;
      name: string | null;
      requests: number;
      tokensInput: number;
      tokensOutput: number;
      costUsd: number;
    }>;
    dailyUsage: Array<{
      date: string;
      requests: number;
      tokensInput: number;
      tokensOutput: number;
      costUsd: number;
    }>;
  };
}

/**
 * GET /api/admin/analytics
 * Admin endpoint for global analytics across all API keys
 *
 * Query params:
 * - days: number of days to look back (default: 30)
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await checkAuth();
  if (authResult.error) return authResult.error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam) : 30;

    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const apiKeyScope =
      authResult.adminContext.role === Role.SUPER_ADMIN
        ? undefined
        : authResult.adminContext.organizationId
          ? eq(apiKeys.organizationId, authResult.adminContext.organizationId)
          : sql`false`;
    const usageScope = apiKeyScope
      ? sql`${usageLogs.timestamp} >= ${startDate} and ${apiKeyScope}`
      : gte(usageLogs.timestamp, startDate);

    // Get total API key counts
    const apiKeyStats = await db
      .select({
        totalKeys: sql<number>`count(*)`,
        activeKeys: sql<number>`count(*) filter (where ${apiKeys.isActive} = true)`,
      })
      .from(apiKeys)
      .where(apiKeyScope)
      .execute();

    // Get overall usage statistics
    const overallStats = await db
      .select({
        totalRequests: sql<number>`count(*)`,
        successfulRequests: sql<number>`count(*) filter (where ${usageLogs.statusCode} < 400)`,
        failedRequests: sql<number>`count(*) filter (where ${usageLogs.statusCode} >= 400)`,
        totalTokensInput: sql<number>`coalesce(sum(${usageLogs.tokensInput}), 0)`,
        totalTokensOutput: sql<number>`coalesce(sum(${usageLogs.tokensOutput}), 0)`,
        totalCostUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      })
      .from(usageLogs)
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id))
      .where(usageScope)
      .execute();

    // Get model breakdown
    const modelData = await db
      .select({
        model: usageLogs.model,
        requests: sql<number>`count(*)`,
        tokensInput: sql<number>`coalesce(sum(${usageLogs.tokensInput}), 0)`,
        tokensOutput: sql<number>`coalesce(sum(${usageLogs.tokensOutput}), 0)`,
        costUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      })
      .from(usageLogs)
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id))
      .where(usageScope)
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

    // Get top API keys by usage
    const topKeysData = await db
      .select({
        apiKeyId: usageLogs.apiKeyId,
        requests: sql<number>`count(*)`,
        tokensInput: sql<number>`coalesce(sum(${usageLogs.tokensInput}), 0)`,
        tokensOutput: sql<number>`coalesce(sum(${usageLogs.tokensOutput}), 0)`,
        costUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      })
      .from(usageLogs)
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id))
      .where(usageScope)
      .groupBy(usageLogs.apiKeyId)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .execute();

    // Enrich top keys with API key details
    const topApiKeys = [];
    for (const keyData of topKeysData) {
      const [key] = await db
        .select({
          id: apiKeys.id,
          keyPrefix: apiKeys.keyPrefix,
          name: apiKeys.name,
        })
        .from(apiKeys)
        .where(eq(apiKeys.id, keyData.apiKeyId))
        .limit(1)
        .execute();

      if (key) {
        topApiKeys.push({
          id: key.id,
          keyPrefix: key.keyPrefix,
          name: key.name,
          requests: keyData.requests,
          tokensInput: keyData.tokensInput,
          tokensOutput: keyData.tokensOutput,
          costUsd: keyData.costUsd,
        });
      }
    }

    // Get daily usage for the last N days
    const dailyData = await db
      .select({
        date: sql<string>`date(${usageLogs.timestamp})`,
        requests: sql<number>`count(*)`,
        tokensInput: sql<number>`coalesce(sum(${usageLogs.tokensInput}), 0)`,
        tokensOutput: sql<number>`coalesce(sum(${usageLogs.tokensOutput}), 0)`,
        costUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      })
      .from(usageLogs)
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id))
      .where(usageScope)
      .groupBy(sql`date(${usageLogs.timestamp})`)
      .orderBy(sql`date(${usageLogs.timestamp})`)
      .execute();

    const stats = overallStats[0];
    const keyStats = apiKeyStats[0];

    return NextResponse.json(
      {
        success: true,
        analytics: {
          overview: {
            totalRequests: stats.totalRequests,
            successfulRequests: stats.successfulRequests,
            failedRequests: stats.failedRequests,
            totalTokensInput: stats.totalTokensInput,
            totalTokensOutput: stats.totalTokensOutput,
            totalCostUsd: stats.totalCostUsd,
            totalApiKeys: keyStats.totalKeys,
            activeApiKeys: keyStats.activeKeys,
          },
          modelBreakdown,
          topApiKeys,
          dailyUsage: dailyData,
        },
      } as AnalyticsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics data',
      } as AnalyticsResponse,
      { status: 500 }
    );
  }
}
