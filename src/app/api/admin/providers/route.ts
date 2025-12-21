import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { providers } from '@/lib/db/schema';
import { encryptApiKey } from '@/lib/utils/crypto';
import { desc } from 'drizzle-orm';

export interface CreateProviderRequest {
  name: string;
  type: 'official' | 'bedrock' | 'custom';
  endpoint?: string;
  apiKey: string;
  costMultiplier?: number;
  defaultRateLimits?: {
    requestsPerMinute: number;
    requestsPerDay: number;
    tokensPerDay: number;
  };
}

export interface CreateProviderResponse {
  success: boolean;
  provider?: {
    id: string;
    name: string;
    type: string;
    endpoint: string;
    isActive: boolean;
    isDefault: boolean;
    createdAt: string;
  };
  error?: string;
}

export interface ListProvidersResponse {
  success: boolean;
  providers?: Array<{
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
    createdAt: string;
    updatedAt: string;
  }>;
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
 * POST /api/admin/providers - Create a new provider
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateProviderRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.type || !body.apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, type, and apiKey',
        } as CreateProviderResponse,
        { status: 400 }
      );
    }

    // Validate provider type
    if (!['official', 'bedrock', 'custom'].includes(body.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid provider type. Must be "official", "bedrock", or "custom"',
        } as CreateProviderResponse,
        { status: 400 }
      );
    }

    // Validate endpoint for custom type
    if (body.type === 'custom' && !body.endpoint) {
      return NextResponse.json(
        {
          success: false,
          error: 'Endpoint is required for custom provider type',
        } as CreateProviderResponse,
        { status: 400 }
      );
    }

    // Encrypt API key
    const encryptedApiKey = await encryptApiKey(body.apiKey);

    // Determine endpoint
    const endpoint = body.endpoint || getDefaultEndpoint(body.type);

    // Default rate limits
    const defaultRateLimits = body.defaultRateLimits || {
      requestsPerMinute: 60,
      requestsPerDay: 1000,
      tokensPerDay: 1000000,
    };

    // Check if this is the first provider
    const existingProviders = await db.select().from(providers).limit(1);
    const isFirstProvider = existingProviders.length === 0;

    // Insert into database
    const [newProvider] = await db
      .insert(providers)
      .values({
        name: body.name,
        type: body.type,
        endpoint,
        apiKey: encryptedApiKey,
        costMultiplier: body.costMultiplier !== undefined ? String(body.costMultiplier) : '1.00',
        isActive: true,
        isDefault: isFirstProvider, // First provider becomes default
        status: 'unknown',
        defaultRateLimits,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        provider: {
          id: newProvider.id,
          name: newProvider.name,
          type: newProvider.type,
          endpoint: newProvider.endpoint,
          isActive: newProvider.isActive,
          isDefault: newProvider.isDefault,
          createdAt: newProvider.createdAt.toISOString(),
        },
      } as CreateProviderResponse,
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating provider:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create provider',
      } as CreateProviderResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/providers - List all providers
 */
export async function GET() {
  try {
    const allProviders = await db
      .select({
        id: providers.id,
        name: providers.name,
        type: providers.type,
        endpoint: providers.endpoint,
        isActive: providers.isActive,
        isDefault: providers.isDefault,
        status: providers.status,
        lastTestedAt: providers.lastTestedAt,
        defaultRateLimits: providers.defaultRateLimits,
        createdAt: providers.createdAt,
        updatedAt: providers.updatedAt,
      })
      .from(providers)
      .orderBy(desc(providers.createdAt));

    return NextResponse.json(
      {
        success: true,
        providers: allProviders.map((provider) => ({
          ...provider,
          lastTestedAt: provider.lastTestedAt?.toISOString() || null,
          defaultRateLimits: provider.defaultRateLimits as {
            requestsPerMinute: number;
            requestsPerDay: number;
            tokensPerDay: number;
          },
          createdAt: provider.createdAt.toISOString(),
          updatedAt: provider.updatedAt.toISOString(),
        })),
      } as ListProvidersResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing providers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list providers',
      } as ListProvidersResponse,
      { status: 500 }
    );
  }
}
