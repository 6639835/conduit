import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usageLogs, apiKeys } from '@/lib/db/schema';
import { desc, gte, and, ne, eq } from 'drizzle-orm';

/**
 * GET /api/admin/logs?type=errors&days=7&limit=100
 * Fetch error logs from the system
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query based on type
    let whereClause;
    if (type === 'errors') {
      whereClause = and(
        gte(usageLogs.timestamp, startDate),
        ne(usageLogs.statusCode, 200)
      );
    } else {
      whereClause = gte(usageLogs.timestamp, startDate);
    }

    const logs = await db
      .select({
        id: usageLogs.id,
        timestamp: usageLogs.timestamp,
        apiKeyId: usageLogs.apiKeyId,
        keyPrefix: apiKeys.keyPrefix,
        method: usageLogs.method,
        path: usageLogs.path,
        model: usageLogs.model,
        statusCode: usageLogs.statusCode,
        errorMessage: usageLogs.errorMessage,
        latencyMs: usageLogs.latencyMs,
        userAgent: usageLogs.userAgent,
        ipAddress: usageLogs.ipAddress,
        country: usageLogs.country,
      })
      .from(usageLogs)
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id))
      .where(whereClause)
      .orderBy(desc(usageLogs.timestamp))
      .limit(limit);

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
