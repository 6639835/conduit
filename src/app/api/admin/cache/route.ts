/**
 * Cache Management API
 * Manage semantic cache, analytics, and cache warming
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { getCacheAnalytics, clearSemanticCache } from '@/lib/cache/semantic';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const warmCacheSchema = z.object({
  apiKeyId: z.string().uuid(),
  entries: z.array(
    z.object({
      prompt: z.string(),
      systemPrompt: z.string().optional(),
      metadata: z.object({
        model: z.string(),
        temperature: z.number().min(0).max(2),
        maxTokens: z.number().positive(),
      }),
    })
  ),
});

/**
 * GET /api/admin/cache?apiKeyId=xxx
 * Get cache analytics for an API key
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

    const analytics = await getCacheAnalytics(apiKeyId);

    return NextResponse.json({
      success: true,
      data: {
        apiKeyId,
        apiKeyName: key.name,
        ...analytics,
      },
    });
  } catch (error) {
    console.error('[Cache] Error getting analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get cache analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cache?apiKeyId=xxx
 * Clear cache for an API key
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
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

    const cleared = await clearSemanticCache(apiKeyId);

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
      data: {
        entriesCleared: cleared,
      },
    });
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cache
 * Cache warming is intentionally disabled until a real provider-backed fetch
 * implementation is wired in. Returning success with mock data would be unsafe.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validation = warmCacheSchema.safeParse(body);

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

    const { apiKeyId } = validation.data;

    // Verify API key exists
    const [key] = await db
      .select({ id: apiKeys.id })
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

    return NextResponse.json({
      success: false,
      error: 'Cache warming is not enabled in this build',
      details: `API key ${apiKeyId} was validated, but cache warming requires a real provider-backed fetch implementation before it can be used in production.`,
    }, { status: 501 });
  } catch (error) {
    console.error('[Cache] Error warming cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to warm cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
