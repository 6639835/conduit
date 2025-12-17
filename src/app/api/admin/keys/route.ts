import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, providers } from '@/lib/db/schema';
import { generateApiKey } from '@/lib/auth/api-key';
import { desc, eq } from 'drizzle-orm';
import type { CreateApiKeyRequest, CreateApiKeyResponse, ListApiKeysResponse } from '@/types';

/**
 * POST /api/admin/keys - Create a new API key
 * TODO: Add authentication middleware (NextAuth) in Phase 7
 */
export async function POST(request: NextRequest) {
  try {
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

    // Insert into database
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
      })
      .returning();

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
 * GET /api/admin/keys - List all API keys
 * TODO: Add authentication middleware (NextAuth) in Phase 7
 */
export async function GET() {
  try {
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
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys)
      .leftJoin(providers, eq(apiKeys.providerId, providers.id))
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json(
      {
        success: true,
        apiKeys: keys.map((key) => ({
          id: key.id,
          keyPrefix: key.keyPrefix,
          name: key.name,
          provider: key.providerName || 'Unknown', // Display provider name
          isActive: key.isActive,
          tokensPerDay: key.tokensPerDay ? Number(key.tokensPerDay) : null,
          requestsPerMinute: key.requestsPerMinute,
          requestsPerDay: key.requestsPerDay,
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
