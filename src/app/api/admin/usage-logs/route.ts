import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usageLogs, apiKeys } from '@/lib/db/schema';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { checkAuth } from '@/lib/auth/middleware';

interface UsageLogsResponse {
  success: boolean;
  logs?: Array<{
    id: string;
    timestamp: string;
    method: string;
    path: string;
    model: string;
    statusCode: number;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    latencyMs: number | null;
    errorMessage: string | null;
    ipAddress: string | null;
    country: string | null;
    keyPrefix: string | null;
    keyName: string | null;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);

    const status = searchParams.get('status');
    const model = searchParams.get('model');
    const keyPrefix = searchParams.get('keyPrefix');
    const path = searchParams.get('path');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const query = searchParams.get('q');

    const filters = [] as Array<ReturnType<typeof sql>>;

    if (status === 'success') {
      filters.push(sql`${usageLogs.statusCode} < 400`);
    }
    if (status === 'error') {
      filters.push(sql`${usageLogs.statusCode} >= 400`);
    }
    if (model) {
      filters.push(eq(usageLogs.model, model));
    }
    if (keyPrefix) {
      filters.push(ilike(apiKeys.keyPrefix, `${keyPrefix}%`));
    }
    if (path) {
      filters.push(ilike(usageLogs.path, `%${path}%`));
    }
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!Number.isNaN(parsedStart.getTime())) {
        filters.push(gte(usageLogs.timestamp, parsedStart));
      }
    }
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!Number.isNaN(parsedEnd.getTime())) {
        parsedEnd.setHours(23, 59, 59, 999);
        filters.push(lte(usageLogs.timestamp, parsedEnd));
      }
    }
    if (query) {
      const likeQuery = `%${query}%`;
      filters.push(
        sql`(${apiKeys.keyPrefix} ILIKE ${likeQuery} OR ${usageLogs.model} ILIKE ${likeQuery} OR ${usageLogs.path} ILIKE ${likeQuery} OR coalesce(${usageLogs.errorMessage}, '') ILIKE ${likeQuery})`
      );
    }

    const whereClause = filters.length ? and(...filters) : undefined;

    const baseQuery = db
      .select({
        id: usageLogs.id,
        timestamp: usageLogs.timestamp,
        method: usageLogs.method,
        path: usageLogs.path,
        model: usageLogs.model,
        statusCode: usageLogs.statusCode,
        tokensInput: usageLogs.tokensInput,
        tokensOutput: usageLogs.tokensOutput,
        costUsd: usageLogs.costUsd,
        latencyMs: usageLogs.latencyMs,
        errorMessage: usageLogs.errorMessage,
        ipAddress: usageLogs.ipAddress,
        country: usageLogs.country,
        keyPrefix: apiKeys.keyPrefix,
        keyName: apiKeys.name,
      })
      .from(usageLogs)
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id));

    const countQuery = db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(usageLogs)
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id));

    const logsQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
    const totalQuery = whereClause ? countQuery.where(whereClause) : countQuery;

    const [countResult, logs] = await Promise.all([
      totalQuery.execute(),
      logsQuery
        .orderBy(desc(usageLogs.timestamp))
        .limit(limit)
        .offset((page - 1) * limit)
        .execute(),
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return NextResponse.json(
      {
        success: true,
        logs: logs.map((log) => ({
          ...log,
          timestamp: log.timestamp.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      } as UsageLogsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching usage logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch usage logs',
      } as UsageLogsResponse,
      { status: 500 }
    );
  }
}
