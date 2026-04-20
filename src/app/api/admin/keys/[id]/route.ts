import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import type { UpdateApiKeyRequest, RevokeApiKeyResponse } from '@/types';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { apiKeyAccessCondition } from '@/lib/auth/api-key-access';

/**
 * PATCH /api/admin/keys/[id] - Update an API key
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(Permission.API_KEY_UPDATE);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const whereClause = apiKeyAccessCondition(id, authResult.adminContext);
    const body: UpdateApiKeyRequest = await request.json();

    // Build update object
    const updates: Partial<typeof apiKeys.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.providerSelectionStrategy !== undefined) updates.providerSelectionStrategy = body.providerSelectionStrategy;
    if (body.requestsPerMinute !== undefined) updates.requestsPerMinute = body.requestsPerMinute;
    if (body.requestsPerDay !== undefined) updates.requestsPerDay = body.requestsPerDay;
    if (body.tokensPerDay !== undefined) updates.tokensPerDay = body.tokensPerDay;
    if (body.monthlySpendLimitUsd !== undefined) updates.monthlySpendLimitUsd = body.monthlySpendLimitUsd;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    // Update in database
    const [updatedKey] = await db
      .update(apiKeys)
      .set(updates)
      .where(whereClause)
      .returning();

    if (!updatedKey) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        apiKey: {
          id: updatedKey.id,
          keyPrefix: updatedKey.keyPrefix,
          name: updatedKey.name,
          provider: updatedKey.provider,
          isActive: updatedKey.isActive,
          updatedAt: updatedKey.updatedAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/keys/[id] - Revoke an API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(Permission.API_KEY_DELETE);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const whereClause = apiKeyAccessCondition(id, authResult.adminContext);

    // Mark as revoked (soft delete)
    const [revokedKey] = await db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(whereClause)
      .returning();

    if (!revokedKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        } as RevokeApiKeyResponse,
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
      } as RevokeApiKeyResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to revoke API key',
      } as RevokeApiKeyResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/keys/[id] - Get a specific API key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(Permission.API_KEY_READ);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const whereClause = apiKeyAccessCondition(id, authResult.adminContext);

    const [apiKey] = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
        provider: apiKeys.provider,
        isActive: apiKeys.isActive,
        revokedAt: apiKeys.revokedAt,
        requestsPerMinute: apiKeys.requestsPerMinute,
        requestsPerDay: apiKeys.requestsPerDay,
        tokensPerDay: apiKeys.tokensPerDay,
        monthlySpendLimitUsd: apiKeys.monthlySpendLimitUsd,
        metadata: apiKeys.metadata,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys)
      .where(whereClause)
      .limit(1);

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        apiKey: {
          ...apiKey,
          tokensPerDay: apiKey.tokensPerDay ? Number(apiKey.tokensPerDay) : null,
          revokedAt: apiKey.revokedAt?.toISOString() || null,
          createdAt: apiKey.createdAt.toISOString(),
          updatedAt: apiKey.updatedAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API key' },
      { status: 500 }
    );
  }
}
