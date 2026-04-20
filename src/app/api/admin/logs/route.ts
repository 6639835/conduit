import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, requestLogs } from '@/lib/db/schema';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission, Role } from '@/lib/auth/rbac';

/**
 * GET /api/admin/logs?apiKeyId=xxx&days=7&limit=100&type=errors
 * Fetch detailed request logs for replay/debugging workflows.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ANALYTICS_VIEW);
    if (!authResult.authorized) return authResult.response;

    const searchParams = request.nextUrl.searchParams;
    const apiKeyId = searchParams.get('apiKeyId');
    const type = searchParams.get('type') || 'all';
    const days = Math.max(parseInt(searchParams.get('days') || '7', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 200);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const filters = [gte(requestLogs.createdAt, startDate)];
    if (authResult.adminContext.role !== Role.SUPER_ADMIN) {
      filters.push(
        authResult.adminContext.organizationId
          ? eq(apiKeys.organizationId, authResult.adminContext.organizationId)
          : sql`false`
      );
    }

    if (apiKeyId) {
      filters.push(eq(requestLogs.apiKeyId, apiKeyId));
    }

    if (type === 'errors') {
      filters.push(gte(requestLogs.statusCode, 400));
    } else if (type === 'success') {
      filters.push(lt(requestLogs.statusCode, 400));
    }

    const logs = await db
      .select({
        id: requestLogs.id,
        apiKeyId: requestLogs.apiKeyId,
        keyPrefix: apiKeys.keyPrefix,
        keyName: apiKeys.name,
        method: requestLogs.method,
        endpoint: requestLogs.endpoint,
        model: requestLogs.model,
        promptTokens: requestLogs.promptTokens,
        completionTokens: requestLogs.completionTokens,
        cost: requestLogs.cost,
        latencyMs: requestLogs.latencyMs,
        statusCode: requestLogs.statusCode,
        errorMessage: requestLogs.errorMessage,
        metadata: requestLogs.metadata,
        createdAt: requestLogs.createdAt,
      })
      .from(requestLogs)
      .leftJoin(apiKeys, eq(requestLogs.apiKeyId, apiKeys.id))
      .where(and(...filters))
      .orderBy(desc(requestLogs.createdAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: logs.map((log) => ({
        ...log,
        cost: Number(log.cost || 0),
        createdAt: log.createdAt.toISOString(),
      })),
      logs: logs.map((log) => ({
        ...log,
        cost: Number(log.cost || 0),
        createdAt: log.createdAt.toISOString(),
      })),
      count: logs.length,
      summary: {
        totalCostCents: logs.reduce((sum, log) => sum + Number(log.cost || 0), 0),
        totalRequests: logs.length,
        errors: logs.filter((log) => log.statusCode >= 400).length,
      },
      requestedApiKeyId: apiKeyId,
    });
  } catch (error) {
    console.error('Error fetching detailed request logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch detailed request logs' },
      { status: 500 }
    );
  }
}
