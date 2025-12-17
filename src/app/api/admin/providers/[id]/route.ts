import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { providers } from '@/lib/db/schema';
import { encryptApiKey } from '@/lib/utils/crypto';
import { eq, ne } from 'drizzle-orm';

export interface UpdateProviderRequest {
  name?: string;
  type?: 'official' | 'bedrock' | 'custom';
  endpoint?: string;
  apiKey?: string;
  isActive?: boolean;
  isDefault?: boolean;
  status?: 'healthy' | 'unhealthy' | 'unknown';
  lastTestedAt?: string;
  defaultRateLimits?: {
    requestsPerMinute: number;
    requestsPerDay: number;
    tokensPerDay: number;
  };
}

export interface UpdateProviderResponse {
  success: boolean;
  provider?: {
    id: string;
    name: string;
    type: string;
    endpoint: string;
    isActive: boolean;
    isDefault: boolean;
    status: string | null;
    lastTestedAt: string | null;
    defaultRateLimits: {
      requestsPerMinute: number;
      requestsPerDay: number;
      tokensPerDay: number;
    };
    updatedAt: string;
  };
  error?: string;
}

export interface DeleteProviderResponse {
  success: boolean;
  error?: string;
}

function getDefaultEndpoint(type: string): string {
  switch (type) {
    case 'official':
      return 'https://api.anthropic.com';
    case 'bedrock':
      return 'https://bedrock-runtime.us-east-1.amazonaws.com';
    default:
      return '';
  }
}

/**
 * PATCH /api/admin/providers/[id] - Update a provider
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateProviderRequest = await request.json();

    // Find existing provider
    const [existingProvider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, id))
      .limit(1);

    if (!existingProvider) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provider not found',
        } as UpdateProviderResponse,
        { status: 404 }
      );
    }

    // Prepare update object
    const updateData: Partial<typeof providers.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Update name if provided
    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    // Update type if provided
    if (body.type !== undefined) {
      if (!['official', 'bedrock', 'custom'].includes(body.type)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid provider type. Must be "official", "bedrock", or "custom"',
          } as UpdateProviderResponse,
          { status: 400 }
        );
      }
      updateData.type = body.type;
    }

    // Update endpoint if provided
    if (body.endpoint !== undefined) {
      updateData.endpoint = body.endpoint;
    } else if (body.type !== undefined) {
      // If type changed but endpoint not provided, use default endpoint
      updateData.endpoint = getDefaultEndpoint(body.type);
    }

    // Update API key if provided
    if (body.apiKey !== undefined && body.apiKey !== '') {
      updateData.apiKey = await encryptApiKey(body.apiKey);
    }

    // Update active status if provided
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    // Update default status if provided
    if (body.isDefault !== undefined) {
      if (body.isDefault) {
        // If setting as default, unset all other providers
        await db
          .update(providers)
          .set({ isDefault: false })
          .where(ne(providers.id, id));
      }
      updateData.isDefault = body.isDefault;
    }

    // Update status if provided
    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // Update lastTestedAt if provided
    if (body.lastTestedAt !== undefined) {
      updateData.lastTestedAt = new Date(body.lastTestedAt);
    }

    // Update default rate limits if provided
    if (body.defaultRateLimits !== undefined) {
      updateData.defaultRateLimits = body.defaultRateLimits;
    }

    // Execute update
    const [updatedProvider] = await db
      .update(providers)
      .set(updateData)
      .where(eq(providers.id, id))
      .returning();

    return NextResponse.json(
      {
        success: true,
        provider: {
          id: updatedProvider.id,
          name: updatedProvider.name,
          type: updatedProvider.type,
          endpoint: updatedProvider.endpoint,
          isActive: updatedProvider.isActive,
          isDefault: updatedProvider.isDefault,
          status: updatedProvider.status,
          lastTestedAt: updatedProvider.lastTestedAt?.toISOString() || null,
          defaultRateLimits: updatedProvider.defaultRateLimits as {
            requestsPerMinute: number;
            requestsPerDay: number;
            tokensPerDay: number;
          },
          updatedAt: updatedProvider.updatedAt.toISOString(),
        },
      } as UpdateProviderResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating provider:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update provider',
      } as UpdateProviderResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/providers/[id] - Delete a provider
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find existing provider
    const [existingProvider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, id))
      .limit(1);

    if (!existingProvider) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provider not found',
        } as DeleteProviderResponse,
        { status: 404 }
      );
    }

    // Prevent deletion of default provider
    if (existingProvider.isDefault) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete the default provider. Set another provider as default first.',
        } as DeleteProviderResponse,
        { status: 400 }
      );
    }

    // Delete the provider
    await db.delete(providers).where(eq(providers.id, id));

    return NextResponse.json(
      {
        success: true,
      } as DeleteProviderResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting provider:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete provider',
      } as DeleteProviderResponse,
      { status: 500 }
    );
  }
}
