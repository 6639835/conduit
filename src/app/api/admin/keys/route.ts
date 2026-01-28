import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, providers } from '@/lib/db/schema';
import { generateApiKey } from '@/lib/auth/api-key';
import { desc, eq, sql } from 'drizzle-orm';
import type { CreateApiKeyResponse, ListApiKeysResponse } from '@/types';
import { SystemNotifications } from '@/lib/notifications';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { z } from 'zod';
import { setProviderPool } from '@/lib/proxy/provider-pool';
import { kv } from '@vercel/kv';

// Validation schema for creating API keys
const createApiKeySchema = z.object({
  name: z.string().max(255).optional(),
  provider: z.string().uuid('Invalid provider ID format').optional(), // Optional now for multi-provider
  providerSelectionStrategy: z.enum(['single', 'priority', 'round-robin', 'least-loaded', 'cost-optimized']).default('single'),
  providerIds: z.array(z.object({
    providerId: z.string().uuid(),
    priority: z.number().int().default(0).optional(),
  })).optional(), // For multi-provider pool
  requestsPerMinute: z.number().int().positive().optional(),
  requestsPerDay: z.number().int().positive().optional(),
  tokensPerDay: z.number().int().positive().optional(),
  monthlySpendLimitUsd: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  ipWhitelist: z.array(z.string()).optional(),
  ipBlacklist: z.array(z.string()).optional(),
  allowedModels: z.array(z.string()).optional(),
  allowedEndpoints: z.array(z.string()).optional(),
  organizationId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * POST /api/admin/keys - Create a new API key
 * Requires: API_KEY_CREATE permission
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission
    const authResult = await requirePermission(Permission.API_KEY_CREATE);
    if (!authResult.authorized) return authResult.response;
    const adminContext = authResult.adminContext;

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = createApiKeySchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as CreateApiKeyResponse,
        { status: 400 }
      );
    }

    const body = validationResult.data;

    // Validate: Either provider (single) or providerIds (multi) must be provided
    if (!body.provider && (!body.providerIds || body.providerIds.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either provider or providerIds must be specified',
        } as CreateApiKeyResponse,
        { status: 400 }
      );
    }

    // Determine primary provider for backward compatibility
    let primaryProviderId: string;
    let providerRecord;

    if (body.provider) {
      // Single provider mode (backward compatibility)
      primaryProviderId = body.provider;
      const [record] = await db
        .select()
        .from(providers)
        .where(eq(providers.id, body.provider))
        .limit(1);

      if (!record) {
        return NextResponse.json(
          {
            success: false,
            error: 'Provider not found',
          } as CreateApiKeyResponse,
          { status: 404 }
        );
      }

      if (!record.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: 'Provider is not active',
          } as CreateApiKeyResponse,
          { status: 400 }
        );
      }

      providerRecord = record;
    } else {
      // Multi-provider mode
      primaryProviderId = body.providerIds![0].providerId;
      const [record] = await db
        .select()
        .from(providers)
        .where(eq(providers.id, primaryProviderId))
        .limit(1);

      if (!record) {
        return NextResponse.json(
          {
            success: false,
            error: 'Primary provider not found',
          } as CreateApiKeyResponse,
          { status: 404 }
        );
      }

      providerRecord = record;
    }

    // Generate API key
    const { fullKey, keyHash, keyPrefix } = await generateApiKey();

    // Insert into database with createdBy field and new security fields
    const [newApiKey] = await db
      .insert(apiKeys)
      .values({
        keyHash,
        keyPrefix,
        name: body.name || null,
        providerId: primaryProviderId, // Primary provider for backward compatibility
        providerSelectionStrategy: body.providerSelectionStrategy || 'single',
        requestsPerMinute: body.requestsPerMinute || 60,
        requestsPerDay: body.requestsPerDay || 1000,
        tokensPerDay: body.tokensPerDay || 1000000,
        monthlySpendLimitUsd: body.monthlySpendLimitUsd || null,
        metadata: body.metadata || null,
        isActive: true,
        createdBy: adminContext.id,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        ipWhitelist: body.ipWhitelist || null,
        ipBlacklist: body.ipBlacklist || null,
        scopes: (body.allowedModels || body.allowedEndpoints) ? {
          models: body.allowedModels || undefined,
          endpoints: body.allowedEndpoints || undefined,
        } : null,
        organizationId: body.organizationId || null,
        projectId: body.projectId || null,
      })
      .returning();

    // Set provider pool (junction table)
    if (body.providerIds && body.providerIds.length > 0) {
      // Multi-provider mode: set full pool
      await setProviderPool(newApiKey.id, body.providerIds);
    } else {
      // Single provider mode: add single provider to pool for consistency
      await setProviderPool(newApiKey.id, [{ providerId: primaryProviderId, priority: 0 }]);
    }

    // Send notification to the admin who created the key
    await SystemNotifications.apiKeyCreated(
      adminContext.id,
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
 * Requires: API_KEY_READ permission
 * Query params: page (default 1), limit (default 50, max 100), includeQuota (default false)
 */
export async function GET(request: NextRequest) {
  try {
    // Check permission
    const authResult = await requirePermission(Permission.API_KEY_READ);
    if (!authResult.authorized) return authResult.response;

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const includeQuota = searchParams.get('includeQuota') === 'true';

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

    // If quota data is requested, fetch usage stats
    const quotaData: Record<string, { tokensUsedToday: number; requestsToday: number }> = {};
    if (includeQuota) {
      const today = new Date().toISOString().slice(0, 10);

      // Fetch current usage from KV for all keys (batch operation)
      for (const key of keys) {
        if (key.isActive) {
          const dayKey = `rate_limit:${key.id}:day:${today}`;
          const tokensCacheKey = `quota:${key.id}:day:${today}:tokens`;

          try {
            const [dayCount, tokensUsed] = await Promise.all([
              kv.get<number>(dayKey),
              kv.get<number>(tokensCacheKey),
            ]);

            quotaData[key.id] = {
              requestsToday: dayCount || 0,
              tokensUsedToday: tokensUsed || 0,
            };
          } catch {
            // Ignore errors for individual keys
            quotaData[key.id] = {
              requestsToday: 0,
              tokensUsedToday: 0,
            };
          }
        }
      }
    }

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
          // Include quota usage if requested
          ...(includeQuota && quotaData[key.id] && {
            quotaUsage: {
              requestsToday: quotaData[key.id].requestsToday,
              tokensUsedToday: quotaData[key.id].tokensUsedToday,
              requestsPercentage: key.requestsPerDay
                ? (quotaData[key.id].requestsToday / key.requestsPerDay) * 100
                : 0,
              tokensPercentage: key.tokensPerDay
                ? (quotaData[key.id].tokensUsedToday / Number(key.tokensPerDay)) * 100
                : 0,
            },
          }),
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
