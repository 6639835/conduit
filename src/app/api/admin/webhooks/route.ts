import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { webhookConfigurations } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';
import { checkAuth } from '@/lib/auth/middleware';
import { z } from 'zod';
import crypto from 'crypto';

const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.enum([
    'quota.warning',
    'quota.exceeded',
    'key.expired',
    'key.expiring_soon',
    'key.created',
    'key.revoked',
    'key.rotated',
    'spend.limit_reached',
    'error.rate_spike',
    'provider.unhealthy',
    'provider.restored',
  ])).min(1),
  apiKeyId: z.string().uuid().optional().nullable(),
  organizationId: z.string().uuid().optional().nullable(),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(10).default(3),
    backoffMultiplier: z.number().min(1).max(10).default(2),
    initialDelay: z.number().int().min(100).max(60000).default(1000),
  }).optional(),
  timeout: z.number().int().min(1000).max(30000).default(5000),
  headers: z.record(z.string(), z.string()).optional(),
});

interface WebhookResponse {
  success: boolean;
  webhook?: typeof webhookConfigurations.$inferSelect;
  webhooks?: Array<typeof webhookConfigurations.$inferSelect & {
    deliveryStats?: {
      total: number;
      successful: number;
      failed: number;
      successRate: number;
    };
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: string;
}

/**
 * POST /api/admin/webhooks - Create a new webhook configuration
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const body = await request.json();
    const validationResult = createWebhookSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as WebhookResponse,
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Generate a secret if not provided
    const secret = data.secret || crypto.randomBytes(32).toString('hex');

    const [newWebhook] = await db
      .insert(webhookConfigurations)
      .values({
        name: data.name,
        description: data.description || null,
        url: data.url,
        secret,
        events: data.events,
        apiKeyId: data.apiKeyId || null,
        organizationId: data.organizationId || null,
        retryPolicy: data.retryPolicy || {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 1000,
        },
        timeout: data.timeout,
        headers: data.headers || null,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        webhook: newWebhook,
      } as WebhookResponse,
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create webhook',
      } as WebhookResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/webhooks - List all webhook configurations
 * Requires authentication
 * Query params: page (default 1), limit (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const webhooks = await db
      .select()
      .from(webhookConfigurations)
      .orderBy(desc(webhookConfigurations.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookConfigurations);

    const totalPages = Math.ceil(count / limit);

    return NextResponse.json(
      {
        success: true,
        webhooks,
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasMore: page < totalPages,
        },
      } as WebhookResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing webhooks:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list webhooks',
      } as WebhookResponse,
      { status: 500 }
    );
  }
}
