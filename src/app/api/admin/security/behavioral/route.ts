/**
 * Behavioral Analysis API
 * Analyze API key usage patterns and detect anomalies
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { analyzeBehavior, getBehavioralPattern } from '@/lib/security/behavioral-analysis';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { apiKeyAccessCondition } from '@/lib/auth/api-key-access';

/**
 * GET /api/admin/security/behavioral?apiKeyId=xxx
 * Get behavioral analysis for an API key
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_READ);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get('apiKeyId');
    const days = parseInt(searchParams.get('days') || '30');
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (!apiKeyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiKeyId parameter required',
        },
        { status: 400 }
      );
    }

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

    // Get or analyze behavioral pattern
    const pattern = forceRefresh
      ? await analyzeBehavior(apiKeyId, days)
      : await getBehavioralPattern(apiKeyId);

    return NextResponse.json({
      success: true,
      data: {
        apiKeyId,
        apiKeyName: key.name,
        pattern,
      },
    });
  } catch (error) {
    console.error('[Security] Error analyzing behavior:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze behavior',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
