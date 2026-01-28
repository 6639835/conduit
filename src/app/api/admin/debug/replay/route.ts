/**
 * Request Replay API
 * Replay historical requests and compare results
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import {
  replayRequest,
  batchReplayRequests,
  getReplayHistory,
} from '@/lib/debug/replay';
import { z } from 'zod';

const replaySchema = z.object({
  requestId: z.string().uuid(),
  useOriginalProvider: z.boolean().optional(),
  overrideModel: z.string().optional(),
  overrideTemperature: z.number().min(0).max(2).optional(),
});

const batchReplaySchema = z.object({
  requestIds: z.array(z.string().uuid()).min(1).max(50),
  useOriginalProvider: z.boolean().optional(),
  overrideModel: z.string().optional(),
});

/**
 * POST /api/admin/debug/replay
 * Replay a single request or batch of requests
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ANALYTICS_VIEW);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Batch replay
    if (action === 'batch') {
      const validation = batchReplaySchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request body',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const results = await batchReplayRequests(validation.data.requestIds, {
        useOriginalProvider: validation.data.useOriginalProvider,
        overrideModel: validation.data.overrideModel,
      });

      return NextResponse.json({
        success: true,
        data: {
          replayed: results.length,
          results,
        },
      });
    }

    // Single replay
    const validation = replaySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const result = await replayRequest(validation.data.requestId, {
      useOriginalProvider: validation.data.useOriginalProvider,
      overrideModel: validation.data.overrideModel,
      overrideTemperature: validation.data.overrideTemperature,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Replay] Error replaying request:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to replay request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/debug/replay?apiKeyId=xxx
 * Get replay history for an API key
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ANALYTICS_VIEW);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get('apiKeyId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!apiKeyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiKeyId parameter required',
        },
        { status: 400 }
      );
    }

    const history = await getReplayHistory(apiKeyId, limit);

    return NextResponse.json({
      success: true,
      data: {
        apiKeyId,
        history,
        total: history.length,
      },
    });
  } catch (error) {
    console.error('[Replay] Error getting history:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get replay history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
