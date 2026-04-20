import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { keyTemplates, providers } from '@/lib/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission, Role } from '@/lib/auth/rbac';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  providerId: z.string().uuid().optional().nullable(),
  providerSelectionStrategy: z.enum(['single', 'priority', 'round-robin', 'least-loaded', 'cost-optimized']).default('single'),
  providerIds: z.array(z.object({
    providerId: z.string().uuid(),
    priority: z.number().int().default(0),
  })).optional(),
  requestsPerMinute: z.number().int().positive().default(60),
  requestsPerDay: z.number().int().positive().default(1000),
  tokensPerDay: z.number().int().positive().default(1000000),
  monthlySpendLimitUsd: z.number().int().positive().optional().nullable(),
  expiresInDays: z.number().int().positive().optional().nullable(),
  ipWhitelist: z.array(z.string()).optional(),
  ipBlacklist: z.array(z.string()).optional(),
  allowedModels: z.array(z.string()).optional(),
  allowedEndpoints: z.array(z.string()).optional(),
  alertThresholds: z.object({
    requestsPerDay: z.array(z.number().min(0).max(100)).optional(),
    tokensPerDay: z.array(z.number().min(0).max(100)).optional(),
    monthlySpend: z.array(z.number().min(0).max(100)).optional(),
  }).optional(),
  emailNotificationsEnabled: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
  slackWebhook: z.string().url().optional(),
  discordWebhook: z.string().url().optional(),
  organizationId: z.string().uuid().optional().nullable(),
});

interface TemplateResponse {
  success: boolean;
  template?: typeof keyTemplates.$inferSelect & {
    providerName?: string | null;
  };
  templates?: Array<typeof keyTemplates.$inferSelect & {
    providerName?: string | null;
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
 * POST /api/admin/key-templates - Create a new API key template
 * Requires API_KEY_CREATE permission
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_CREATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validationResult = createTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as TemplateResponse,
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const organizationId =
      authResult.adminContext.role === Role.SUPER_ADMIN
        ? data.organizationId || null
        : authResult.adminContext.organizationId;

    if (authResult.adminContext.role !== Role.SUPER_ADMIN) {
      if (!authResult.adminContext.organizationId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Admin is not assigned to an organization',
          } as TemplateResponse,
          { status: 403 }
        );
      }

      if (data.organizationId && data.organizationId !== authResult.adminContext.organizationId) {
        return NextResponse.json(
          {
            success: false,
            error: 'You do not have access to this organization',
          } as TemplateResponse,
          { status: 403 }
        );
      }
    }

    // Validate provider if specified
    if (data.providerId) {
      const [provider] = await db
        .select()
        .from(providers)
        .where(eq(providers.id, data.providerId))
        .limit(1);

      if (!provider || !provider.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid or inactive provider',
          } as TemplateResponse,
          { status: 400 }
        );
      }
    }

    // Create template
    const [newTemplate] = await db
      .insert(keyTemplates)
      .values({
        name: data.name,
        description: data.description || null,
        providerId: data.providerId || null,
        providerSelectionStrategy: data.providerSelectionStrategy,
        providerIds: data.providerIds || null,
        requestsPerMinute: data.requestsPerMinute,
        requestsPerDay: data.requestsPerDay,
        tokensPerDay: data.tokensPerDay,
        monthlySpendLimitUsd: data.monthlySpendLimitUsd || null,
        expiresInDays: data.expiresInDays || null,
        ipWhitelist: data.ipWhitelist || null,
        ipBlacklist: data.ipBlacklist || null,
        scopes: (data.allowedModels || data.allowedEndpoints) ? {
          models: data.allowedModels,
          endpoints: data.allowedEndpoints,
        } : null,
        alertThresholds: data.alertThresholds || {
          requestsPerDay: [80, 90],
          tokensPerDay: [80, 90],
          monthlySpend: [80, 90],
        },
        emailNotificationsEnabled: data.emailNotificationsEnabled,
        webhookUrl: data.webhookUrl || null,
        slackWebhook: data.slackWebhook || null,
        discordWebhook: data.discordWebhook || null,
        organizationId,
        createdBy: authResult.adminContext.id,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        template: newTemplate,
      } as TemplateResponse,
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating key template:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create key template',
      } as TemplateResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/key-templates - List all key templates
 * Requires API_KEY_READ permission
 * Query params: page (default 1), limit (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_READ);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const conditions = [eq(keyTemplates.isActive, true)];
    if (authResult.adminContext.role !== Role.SUPER_ADMIN) {
      conditions.push(
        authResult.adminContext.organizationId
          ? eq(keyTemplates.organizationId, authResult.adminContext.organizationId)
          : sql`false`
      );
    }
    const whereClause = and(...conditions);

    const templates = await db
      .select({
        id: keyTemplates.id,
        name: keyTemplates.name,
        description: keyTemplates.description,
        providerId: keyTemplates.providerId,
        providerName: providers.name,
        providerSelectionStrategy: keyTemplates.providerSelectionStrategy,
        providerIds: keyTemplates.providerIds,
        requestsPerMinute: keyTemplates.requestsPerMinute,
        requestsPerDay: keyTemplates.requestsPerDay,
        tokensPerDay: keyTemplates.tokensPerDay,
        monthlySpendLimitUsd: keyTemplates.monthlySpendLimitUsd,
        expiresInDays: keyTemplates.expiresInDays,
        ipWhitelist: keyTemplates.ipWhitelist,
        ipBlacklist: keyTemplates.ipBlacklist,
        scopes: keyTemplates.scopes,
        alertThresholds: keyTemplates.alertThresholds,
        emailNotificationsEnabled: keyTemplates.emailNotificationsEnabled,
        webhookUrl: keyTemplates.webhookUrl,
        slackWebhook: keyTemplates.slackWebhook,
        discordWebhook: keyTemplates.discordWebhook,
        organizationId: keyTemplates.organizationId,
        isActive: keyTemplates.isActive,
        usageCount: keyTemplates.usageCount,
        createdBy: keyTemplates.createdBy,
        createdAt: keyTemplates.createdAt,
        updatedAt: keyTemplates.updatedAt,
      })
      .from(keyTemplates)
      .leftJoin(providers, eq(keyTemplates.providerId, providers.id))
      .where(whereClause)
      .orderBy(desc(keyTemplates.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(keyTemplates)
      .where(whereClause);

    const totalPages = Math.ceil(count / limit);

    return NextResponse.json(
      {
        success: true,
        templates: templates.map(t => ({
          ...t,
          tokensPerDay: t.tokensPerDay ? Number(t.tokensPerDay) : null,
        })),
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasMore: page < totalPages,
        },
      } as TemplateResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing key templates:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list key templates',
      } as TemplateResponse,
      { status: 500 }
    );
  }
}
