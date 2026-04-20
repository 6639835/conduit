/**
 * Programmatic Admin API v1 - API Keys Management
 *
 * RESTful API for managing API keys programmatically
 * Requires API key authentication with admin:manage scope
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission, Role } from '@/lib/auth/rbac';
import { db } from '@/lib/db';
import { apiKeys, providers } from '@/lib/db/schema';
import { generateApiKey } from '@/lib/auth/api-key';
import { desc, eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

// API versioning
const API_VERSION = 'v1';

const createApiKeySchema = z.object({
  name: z.string().max(255).optional(),
  providerId: z.string().uuid(),
  requestsPerMinute: z.number().int().positive().optional(),
  requestsPerDay: z.number().int().positive().optional(),
  tokensPerDay: z.number().int().positive().optional(),
  monthlySpendLimitUsd: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  organizationId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * GET /api/v1/admin/keys
 * List API keys with pagination and filtering
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - organizationId: Filter by organization
 * - isActive: Filter by active status (true/false)
 *
 * Response: Paginated list of API keys
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_READ);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const organizationId = searchParams.get('organizationId');
    const isActive = searchParams.get('isActive');

    // Build query conditions
    const conditions = [];
    if (authResult.adminContext.role === Role.SUPER_ADMIN) {
      if (organizationId) {
        conditions.push(eq(apiKeys.organizationId, organizationId));
      }
    } else if (authResult.adminContext.organizationId) {
      if (organizationId && organizationId !== authResult.adminContext.organizationId) {
        conditions.push(sql`false`);
      } else {
        conditions.push(eq(apiKeys.organizationId, authResult.adminContext.organizationId));
      }
    } else {
      conditions.push(sql`false`);
    }
    if (isActive !== null) {
      conditions.push(eq(apiKeys.isActive, isActive === 'true'));
    }

    const keys = await db
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
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeys)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({
      success: true,
      version: API_VERSION,
      data: keys,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        hasMore: page < Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('[API v1] Error listing API keys:', error);
    return NextResponse.json(
      {
        success: false,
        version: API_VERSION,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list API keys',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/keys
 * Create a new API key
 *
 * Request body: CreateApiKeyRequest
 * Response: Created API key with full key value (only shown once)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_CREATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validation = createApiKeySchema.safeParse(body);

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
    const organizationId =
      authResult.adminContext.role === Role.SUPER_ADMIN
        ? data.organizationId || null
        : authResult.adminContext.organizationId;

    if (authResult.adminContext.role !== Role.SUPER_ADMIN) {
      if (!authResult.adminContext.organizationId) {
        return NextResponse.json(
          {
            success: false,
            version: API_VERSION,
            error: {
              code: 'FORBIDDEN',
              message: 'Admin is not assigned to an organization',
            },
          },
          { status: 403 }
        );
      }

      if (data.organizationId && data.organizationId !== authResult.adminContext.organizationId) {
        return NextResponse.json(
          {
            success: false,
            version: API_VERSION,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have access to this organization',
            },
          },
          { status: 403 }
        );
      }
    }

    // Verify provider exists
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, data.providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        {
          success: false,
          version: API_VERSION,
          error: {
            code: 'PROVIDER_NOT_FOUND',
            message: 'Provider not found',
          },
        },
        { status: 404 }
      );
    }

    // Generate API key
    const { fullKey, keyHash, keyPrefix } = await generateApiKey();

    // Create API key
    const [newKey] = await db
      .insert(apiKeys)
      .values({
        keyHash,
        keyPrefix,
        name: data.name || null,
        providerId: data.providerId,
        requestsPerMinute: data.requestsPerMinute || null,
        requestsPerDay: data.requestsPerDay || null,
        tokensPerDay: data.tokensPerDay ?? null,
        monthlySpendLimitUsd: data.monthlySpendLimitUsd ?? null,
        organizationId,
        projectId: data.projectId || null,
        metadata: data.metadata || null,
        isActive: true,
        createdBy: authResult.adminContext.id,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        version: API_VERSION,
        data: {
          id: newKey.id,
          key: fullKey, // Full key only shown on creation
          keyPrefix: newKey.keyPrefix,
          name: newKey.name,
          providerId: newKey.providerId,
          createdAt: newKey.createdAt,
        },
        message: 'API key created successfully. Save the key value - it will not be shown again.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API v1] Error creating API key:', error);
    return NextResponse.json(
      {
        success: false,
        version: API_VERSION,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create API key',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
