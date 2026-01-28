/**
 * Programmatic Admin API v1 - Individual API Key Operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const API_VERSION = 'v1';

const updateApiKeySchema = z.object({
  name: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
  requestsPerMinute: z.number().int().positive().optional(),
  requestsPerDay: z.number().int().positive().optional(),
  tokensPerDay: z.number().int().positive().optional(),
  monthlySpendLimitUsd: z.number().positive().optional(),
});

/**
 * GET /api/v1/admin/keys/[id]
 * Get API key details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_READ);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;

    const [key] = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
        providerId: apiKeys.providerId,
        isActive: apiKeys.isActive,
        requestsPerMinute: apiKeys.requestsPerMinute,
        requestsPerDay: apiKeys.requestsPerDay,
        tokensPerDay: apiKeys.tokensPerDay,
        monthlySpendLimitUsd: apiKeys.monthlySpendLimitUsd,
        organizationId: apiKeys.organizationId,
        projectId: apiKeys.projectId,
        metadata: apiKeys.metadata,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          version: API_VERSION,
          error: {
            code: 'NOT_FOUND',
            message: 'API key not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      version: API_VERSION,
      data: key,
    });
  } catch (error) {
    console.error('[API v1] Error getting API key:', error);
    return NextResponse.json(
      {
        success: false,
        version: API_VERSION,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get API key',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/admin/keys/[id]
 * Update API key
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const body = await request.json();
    const validation = updateApiKeySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          version: API_VERSION,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validation.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Update API key
    const [updated] = await db
      .update(apiKeys)
      .set({
        ...data,
        tokensPerDay: data.tokensPerDay ?? undefined,
        monthlySpendLimitUsd: data.monthlySpendLimitUsd ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          version: API_VERSION,
          error: {
            code: 'NOT_FOUND',
            message: 'API key not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      version: API_VERSION,
      data: updated,
      message: 'API key updated successfully',
    });
  } catch (error) {
    console.error('[API v1] Error updating API key:', error);
    return NextResponse.json(
      {
        success: false,
        version: API_VERSION,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update API key',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/keys/[id]
 * Delete (revoke) API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_DELETE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;

    // Revoke API key (soft delete)
    const [revoked] = await db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))
      .returning({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix });

    if (!revoked) {
      return NextResponse.json(
        {
          success: false,
          version: API_VERSION,
          error: {
            code: 'NOT_FOUND',
            message: 'API key not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      version: API_VERSION,
      message: 'API key revoked successfully',
      data: {
        id: revoked.id,
        keyPrefix: revoked.keyPrefix,
      },
    });
  } catch (error) {
    console.error('[API v1] Error revoking API key:', error);
    return NextResponse.json(
      {
        success: false,
        version: API_VERSION,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to revoke API key',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
