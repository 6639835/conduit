/**
 * Request Comparison API
 * Compare original and replayed requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission, Role } from '@/lib/auth/rbac';
import { compareRequests } from '@/lib/debug/replay';
import { db } from '@/lib/db';
import { apiKeys, requestLogs } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

/**
 * GET /api/admin/debug/compare?original=xxx&replay=yyy
 * Compare two requests and show differences
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ANALYTICS_VIEW);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const originalId = searchParams.get('original');
    const replayId = searchParams.get('replay');

    if (!originalId || !replayId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Both original and replay request IDs are required',
        },
        { status: 400 }
      );
    }

    const conditions = [eq(requestLogs.id, originalId)];
    if (authResult.adminContext.role !== Role.SUPER_ADMIN) {
      conditions.push(
        authResult.adminContext.organizationId
          ? eq(apiKeys.organizationId, authResult.adminContext.organizationId)
          : sql`false`
      );
    }

    const [requestLog] = await db
      .select({ id: requestLogs.id })
      .from(requestLogs)
      .innerJoin(apiKeys, eq(requestLogs.apiKeyId, apiKeys.id))
      .where(and(...conditions))
      .limit(1);

    if (!requestLog) {
      return NextResponse.json(
        {
          success: false,
          error: 'Original request not found',
        },
        { status: 404 }
      );
    }

    const comparison = await compareRequests(originalId, replayId);

    return NextResponse.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error('[Compare] Error comparing requests:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to compare requests',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
