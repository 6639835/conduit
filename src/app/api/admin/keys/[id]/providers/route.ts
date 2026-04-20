import { NextRequest, NextResponse } from 'next/server';
import { getProviderPool, addProviderToPool, removeProviderFromPool, updateProviderPriority } from '@/lib/proxy/provider-pool';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { canAccessApiKey } from '@/lib/auth/api-key-access';
import { z } from 'zod';

// Validation schema for adding provider to pool
const addProviderSchema = z.object({
  providerId: z.string().uuid('Invalid provider ID format'),
  priority: z.number().int().default(0).optional(),
});

// Validation schema for updating provider priority
const updatePrioritySchema = z.object({
  priority: z.number().int(),
});

/**
 * GET /api/admin/keys/[id]/providers - List providers in API key's pool
 * Requires authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_READ);
    if (!authResult.authorized) return authResult.response;

    const { id: apiKeyId } = await params;
    if (!(await canAccessApiKey(apiKeyId, authResult.adminContext))) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    // Get provider pool
    const providers = await getProviderPool(apiKeyId);

    return NextResponse.json(
      {
        success: true,
        providers: providers.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          status: p.status,
          isActive: p.isActive,
          priority: p.priority,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching provider pool:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch provider pool' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/keys/[id]/providers - Add provider to API key's pool
 * Requires authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { id: apiKeyId } = await params;
    if (!(await canAccessApiKey(apiKeyId, authResult.adminContext))) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = addProviderSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        },
        { status: 400 }
      );
    }

    const { providerId, priority = 0 } = validationResult.data;

    // Add provider to pool
    await addProviderToPool(apiKeyId, providerId, priority);

    return NextResponse.json(
      {
        success: true,
        message: 'Provider added to pool successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding provider to pool:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add provider to pool' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/keys/[id]/providers/[providerId] - Remove provider from pool
 * Requires authentication
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { id: apiKeyId } = await params;
    if (!(await canAccessApiKey(apiKeyId, authResult.adminContext))) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    // Get provider ID from query parameter
    const url = new URL(request.url);
    const providerId = url.searchParams.get('providerId');

    if (!providerId) {
      return NextResponse.json(
        { success: false, error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    // Remove provider from pool
    await removeProviderFromPool(apiKeyId, providerId);

    return NextResponse.json(
      {
        success: true,
        message: 'Provider removed from pool successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error removing provider from pool:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove provider from pool' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/keys/[id]/providers/[providerId] - Update provider priority in pool
 * Requires authentication
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { id: apiKeyId } = await params;
    if (!(await canAccessApiKey(apiKeyId, authResult.adminContext))) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    // Get provider ID from query parameter
    const url = new URL(request.url);
    const providerId = url.searchParams.get('providerId');

    if (!providerId) {
      return NextResponse.json(
        { success: false, error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = updatePrioritySchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        },
        { status: 400 }
      );
    }

    const { priority } = validationResult.data;

    // Update provider priority
    await updateProviderPriority(apiKeyId, providerId, priority);

    return NextResponse.json(
      {
        success: true,
        message: 'Provider priority updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating provider priority:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update provider priority' },
      { status: 500 }
    );
  }
}
