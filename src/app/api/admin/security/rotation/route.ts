/**
 * Key Rotation API
 * Schedule and manage automatic key rotation
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import {
  scheduleKeyRotation,
  checkKeyRotation,
} from '@/lib/security/behavioral-analysis';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { apiKeyAccessCondition, canAccessApiKey } from '@/lib/auth/api-key-access';
import { z } from 'zod';

const scheduleRotationSchema = z.object({
  apiKeyId: z.string().uuid(),
  intervalDays: z.number().int().min(1).max(365),
});

/**
 * POST /api/admin/security/rotation
 * Schedule key rotation
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validation = scheduleRotationSchema.safeParse(body);

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

    const { apiKeyId, intervalDays } = validation.data;

    // Verify API key exists
    const [key] = await db
      .select({ id: apiKeys.id, name: apiKeys.name })
      .from(apiKeys)
      .where(apiKeyAccessCondition(apiKeyId, authResult.adminContext))
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

    const schedule = await scheduleKeyRotation(apiKeyId, intervalDays);

    return NextResponse.json({
      success: true,
      message: 'Key rotation scheduled successfully',
      data: schedule,
    });
  } catch (error) {
    console.error('[Security] Error scheduling rotation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to schedule key rotation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/security/rotation?apiKeyId=xxx
 * Check rotation status
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_READ);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get('apiKeyId');

    if (!apiKeyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiKeyId parameter required',
        },
        { status: 400 }
      );
    }

    if (!(await canAccessApiKey(apiKeyId, authResult.adminContext))) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        },
        { status: 404 }
      );
    }

    const { needsRotation, schedule } = await checkKeyRotation(apiKeyId);

    return NextResponse.json({
      success: true,
      data: {
        apiKeyId,
        needsRotation,
        schedule,
      },
    });
  } catch (error) {
    console.error('[Security] Error checking rotation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check rotation status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
