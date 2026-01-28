/**
 * Debug Mode API
 * Enable/disable debug mode and view debug logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import {
  enableDebugMode,
  isDebugModeEnabled,
  getDebugLogs,
} from '@/lib/debug/replay';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const enableDebugSchema = z.object({
  apiKeyId: z.string().uuid(),
  durationMinutes: z.number().min(1).max(1440).optional().default(60),
});

/**
 * POST /api/admin/debug/mode
 * Enable debug mode for an API key
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validation = enableDebugSchema.safeParse(body);

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

    const { apiKeyId, durationMinutes } = validation.data;

    // Verify API key exists
    const [key] = await db
      .select({ id: apiKeys.id, name: apiKeys.name })
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId))
      .limit(1);

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        },
        { status: 404 }
      );
    }

    await enableDebugMode(apiKeyId, durationMinutes);

    return NextResponse.json({
      success: true,
      message: `Debug mode enabled for ${durationMinutes} minutes`,
      data: {
        apiKeyId,
        durationMinutes,
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
      },
    });
  } catch (error) {
    console.error('[Debug] Error enabling debug mode:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to enable debug mode',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/debug/mode?apiKeyId=xxx
 * Check debug mode status and get logs
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ANALYTICS_VIEW);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get('apiKeyId');
    const action = searchParams.get('action');

    if (!apiKeyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiKeyId parameter required',
        },
        { status: 400 }
      );
    }

    // Get debug logs
    if (action === 'logs') {
      const limit = parseInt(searchParams.get('limit') || '50');
      const logs = await getDebugLogs(apiKeyId, limit);

      return NextResponse.json({
        success: true,
        data: {
          apiKeyId,
          logs,
          total: logs.length,
        },
      });
    }

    // Check debug mode status
    const enabled = await isDebugModeEnabled(apiKeyId);

    return NextResponse.json({
      success: true,
      data: {
        apiKeyId,
        debugModeEnabled: enabled,
      },
    });
  } catch (error) {
    console.error('[Debug] Error checking debug mode:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check debug mode',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
