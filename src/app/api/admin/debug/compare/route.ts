/**
 * Request Comparison API
 * Compare original and replayed requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { compareRequests } from '@/lib/debug/replay';

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
