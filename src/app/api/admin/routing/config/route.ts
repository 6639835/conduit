/**
 * Auto-Routing Configuration API
 * Manage intelligent routing settings for API keys
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { getAutoRoutingConfig, updateAutoRoutingConfig } from '@/lib/proxy/intelligent-routing';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { apiKeyAccessCondition, canAccessApiKey } from '@/lib/auth/api-key-access';
import { z } from 'zod';

const autoRoutingConfigSchema = z.object({
  enabled: z.boolean(),
  preferences: z.object({
    optimizeFor: z.enum(['cost', 'quality', 'speed', 'balanced']),
    maxCostPerRequest: z.number().positive().optional(),
    preferredProvider: z.enum(['claude', 'openai', 'gemini']).optional(),
    requireRegion: z.string().optional(),
    allowFallback: z.boolean(),
  }),
  learningEnabled: z.boolean(),
  overrideModel: z.string().optional(),
});

/**
 * GET /api/admin/routing/config?apiKeyId=xxx
 * Get auto-routing configuration for an API key
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

    const config = await getAutoRoutingConfig(apiKeyId);

    return NextResponse.json({
      success: true,
      data: config || {
        enabled: false,
        preferences: {
          optimizeFor: 'balanced',
          allowFallback: true,
        },
        learningEnabled: false,
      },
    });
  } catch (error) {
    console.error('[Routing] Error getting config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get routing configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/routing/config
 * Update auto-routing configuration for an API key
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const { apiKeyId, config } = body;

    if (!apiKeyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiKeyId is required',
        },
        { status: 400 }
      );
    }

    const validation = autoRoutingConfigSchema.safeParse(config);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid configuration',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    // Verify API key exists
    const [key] = await db
      .select({ id: apiKeys.id })
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

    await updateAutoRoutingConfig(apiKeyId, validation.data);

    return NextResponse.json({
      success: true,
      message: 'Auto-routing configuration updated',
      data: validation.data,
    });
  } catch (error) {
    console.error('[Routing] Error updating config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update routing configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
