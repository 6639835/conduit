import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, providers } from '@/lib/db/schema';
import { generateApiKey } from '@/lib/auth/api-key';
import { desc, eq, sql } from 'drizzle-orm';
import type { CreateApiKeyRequest, CreateApiKeyResponse, ListApiKeysResponse } from '@/types';
import { SystemNotifications } from '@/lib/notifications';
import { auth } from '@/lib/auth';

/**
 * POST /api/admin/keys - Create a new API key
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        } as CreateApiKeyResponse,
        { status: 401 }
      );
    }

    const body: CreateApiKeyRequest = await request.json();

    // Validate required fields
    if (!body.provider) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: provider',
        } as CreateApiKeyResponse,
        { status: 400 }
      );
    }

    // Verify provider exists and is active
    const [providerRecord] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, body.provider))
      .limit(1);

    if (!providerRecord) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provider not found',
        } as CreateApiKeyResponse,
        { status: 404 }
      );
    }

    if (!providerRecord.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provider is not active',
        } as CreateApiKeyResponse,
        { status: 400 }
      );
    }

    // Generate API key
    const { fullKey, keyHash, keyPrefix } = await generateApiKey();

    // Insert into database with createdBy field
    const [newApiKey] = await db
      .insert(apiKeys)
      .values({
        keyHash,
        keyPrefix,
        name: body.name || null,
        providerId: body.provider, // Now using providerId
        requestsPerMinute: body.requestsPerMinute || 60,
        requestsPerDay: body.requestsPerDay || 1000,
        tokensPerDay: body.tokensPerDay || 1000000,
        monthlySpendLimitUsd: body.monthlySpendLimitUsd || null,
        metadata: body.metadata || null,
        isActive: true,
        createdBy: session.user.id,
      })
      .returning();

    // Send notification to the admin who created the key
    await SystemNotifications.apiKeyCreated(
      session.user.id,
      body.name || null,
      keyPrefix
    ).catch(err => console.error('Failed to send notification:', err));

    return NextResponse.json(
      {
        success: true,
        apiKey: {
          id: newApiKey.id,
          fullKey, // Only returned once!
          keyPrefix: newApiKey.keyPrefix,
          name: newApiKey.name,
          provider: providerRecord.name, // Return provider name for display
          isActive: newApiKey.isActive,
          createdAt: newApiKey.createdAt.toISOString(),
        },
      } as CreateApiKeyResponse,
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create API key',
      } as CreateApiKeyResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/keys - List all API keys with pagination
 * Requires authentication
 * Query params: page (default 1), limit (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        } as ListApiKeysResponse,
        { status: 401 }
      );
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const keys = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
        providerId: apiKeys.providerId,
        providerName: providers.name,
        isActive: apiKeys.isActive,
        revokedAt: apiKeys.revokedAt,
        requestsPerMinute: apiKeys.requestsPerMinute,
        requestsPerDay: apiKeys.requestsPerDay,
        tokensPerDay: apiKeys.tokensPerDay,
        monthlySpendLimitUsd: apiKeys.monthlySpendLimitUsd,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys)
      .leftJoin(providers, eq(apiKeys.providerId, providers.id))
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeys);

    const totalPages = Math.ceil(count / limit);

    return NextResponse.json(
      {
        success: true,
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasMore: page < totalPages,
        },
        apiKeys: keys.map((key) => ({
          id: key.id,
          keyPrefix: key.keyPrefix,
          name: key.name,
          provider: key.providerName || 'Unknown', // Display provider name
          isActive: key.isActive,
          tokensPerDay: key.tokensPerDay ? Number(key.tokensPerDay) : null,
          requestsPerMinute: key.requestsPerMinute,
          requestsPerDay: key.requestsPerDay,
          monthlySpendLimitUsd: key.monthlySpendLimitUsd ? Number(key.monthlySpendLimitUsd) : null,
          revokedAt: key.revokedAt?.toISOString() || null,
          createdAt: key.createdAt.toISOString(),
          updatedAt: key.updatedAt.toISOString(),
        })),
      } as ListApiKeysResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing API keys:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list API keys',
      } as ListApiKeysResponse,
      { status: 500 }
    );
  }
}
