import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, keyTemplates, providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/auth/middleware';
import { z } from 'zod';
import { generateApiKey } from '@/lib/auth/api-key';
import { setProviderPool } from '@/lib/proxy/provider-pool';
import { SystemNotifications } from '@/lib/notifications';

const bulkCreateSchema = z.object({
  operation: z.literal('create'),
  count: z.number().int().min(1).max(100),
  templateId: z.string().uuid().optional(),
  namePrefix: z.string().max(200).optional(),
  // If no template, require these fields
  providerId: z.string().uuid().optional(),
  requestsPerMinute: z.number().int().positive().optional(),
  requestsPerDay: z.number().int().positive().optional(),
  tokensPerDay: z.number().int().positive().optional(),
  monthlySpendLimitUsd: z.number().int().positive().optional(),
});

const bulkRevokeSchema = z.object({
  operation: z.literal('revoke'),
  apiKeyIds: z.array(z.string().uuid()).min(1).max(100),
});

const bulkUpdateSchema = z.object({
  operation: z.literal('update'),
  apiKeyIds: z.array(z.string().uuid()).min(1).max(100),
  updates: z.object({
    requestsPerMinute: z.number().int().positive().optional(),
    requestsPerDay: z.number().int().positive().optional(),
    tokensPerDay: z.number().int().positive().optional(),
    monthlySpendLimitUsd: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

const bulkOperationSchema = z.discriminatedUnion('operation', [
  bulkCreateSchema,
  bulkRevokeSchema,
  bulkUpdateSchema,
]);

interface BulkOperationResponse {
  success: boolean;
  operation?: string;
  results?: {
    successful: number;
    failed: number;
    details: Array<{
      id?: string;
      keyPrefix?: string;
      fullKey?: string;
      status: 'success' | 'error';
      error?: string;
    }>;
  };
  error?: string;
}

/**
 * POST /api/admin/keys/bulk - Perform bulk operations on API keys
 * Requires authentication
 * Supports: create (bulk key creation from template), revoke (bulk revocation), update (bulk updates)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const body = await request.json();
    const validationResult = bulkOperationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as BulkOperationResponse,
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Handle different operations
    if (data.operation === 'create') {
      return handleBulkCreate(data, session.user.id);
    } else if (data.operation === 'revoke') {
      return handleBulkRevoke(data);
    } else if (data.operation === 'update') {
      return handleBulkUpdate(data);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unknown operation',
      } as BulkOperationResponse,
      { status: 400 }
    );
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform bulk operation',
      } as BulkOperationResponse,
      { status: 500 }
    );
  }
}

async function handleBulkCreate(
  data: z.infer<typeof bulkCreateSchema>,
  adminId: string
): Promise<NextResponse<BulkOperationResponse>> {
  const results: Array<{
    id?: string;
    keyPrefix?: string;
    fullKey?: string;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  let template: typeof keyTemplates.$inferSelect | undefined;
  let provider: typeof providers.$inferSelect | undefined;

  // Get template if specified
  if (data.templateId) {
    const [tmpl] = await db
      .select()
      .from(keyTemplates)
      .where(eq(keyTemplates.id, data.templateId))
      .limit(1);

    if (!tmpl || !tmpl.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template not found or inactive',
        } as BulkOperationResponse,
        { status: 404 }
      );
    }

    template = tmpl;
  } else if (data.providerId) {
    // If no template, validate provider
    const [prov] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, data.providerId))
      .limit(1);

    if (!prov || !prov.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provider not found or inactive',
        } as BulkOperationResponse,
        { status: 404 }
      );
    }

    provider = prov;
  } else {
    return NextResponse.json(
      {
        success: false,
        error: 'Either templateId or providerId must be specified',
      } as BulkOperationResponse,
      { status: 400 }
    );
  }

  // Create keys
  for (let i = 0; i < data.count; i++) {
    try {
      const { fullKey, keyHash, keyPrefix } = await generateApiKey();

      const keyName = data.namePrefix
        ? `${data.namePrefix} ${i + 1}`
        : template
          ? `${template.name} ${i + 1}`
          : `Bulk Key ${i + 1}`;

      // Determine settings from template or data
      const settings = template ? {
        providerId: template.providerId!,
        providerSelectionStrategy: template.providerSelectionStrategy || 'single',
        requestsPerMinute: template.requestsPerMinute || 60,
        requestsPerDay: template.requestsPerDay || 1000,
        tokensPerDay: template.tokensPerDay || 1000000,
        monthlySpendLimitUsd: template.monthlySpendLimitUsd,
        expiresAt: template.expiresInDays
          ? new Date(Date.now() + template.expiresInDays * 86400000)
          : null,
        ipWhitelist: template.ipWhitelist,
        ipBlacklist: template.ipBlacklist,
        scopes: template.scopes,
        alertThresholds: template.alertThresholds,
        emailNotificationsEnabled: template.emailNotificationsEnabled ?? false,
        webhookUrl: template.webhookUrl,
        slackWebhook: template.slackWebhook,
        discordWebhook: template.discordWebhook,
        organizationId: template.organizationId,
      } : {
        providerId: provider!.id,
        providerSelectionStrategy: 'single' as const,
        requestsPerMinute: data.requestsPerMinute || 60,
        requestsPerDay: data.requestsPerDay || 1000,
        tokensPerDay: data.tokensPerDay || 1000000,
        monthlySpendLimitUsd: data.monthlySpendLimitUsd || null,
        expiresAt: null,
        ipWhitelist: null,
        ipBlacklist: null,
        scopes: null,
        alertThresholds: { requestsPerDay: [80, 90], tokensPerDay: [80, 90], monthlySpend: [80, 90] },
        emailNotificationsEnabled: false,
        webhookUrl: null,
        slackWebhook: null,
        discordWebhook: null,
        organizationId: null,
      };

      const [newKey] = await db
        .insert(apiKeys)
        .values({
          keyHash,
          keyPrefix,
          name: keyName,
          ...settings,
          isActive: true,
          createdBy: adminId,
        })
        .returning();

      // Set provider pool
      await setProviderPool(newKey.id, [{ providerId: settings.providerId, priority: 0 }]);

      results.push({
        id: newKey.id,
        keyPrefix: newKey.keyPrefix,
        fullKey, // Only returned once during creation
        status: 'success',
      });
    } catch (error) {
      console.error(`Failed to create key ${i + 1}:`, error);
      results.push({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Increment template usage count if template was used
  if (template) {
    await db
      .update(keyTemplates)
      .set({
        usageCount: (template.usageCount || 0) + results.filter(r => r.status === 'success').length,
        updatedAt: new Date(),
      })
      .where(eq(keyTemplates.id, template.id));
  }

  // Send notification
  try {
    await SystemNotifications.apiKeyCreated(
      adminId,
      `Bulk created ${results.filter(r => r.status === 'success').length} keys`,
      results.length > 0 ? results[0].keyPrefix || 'N/A' : 'N/A'
    );
  } catch (error) {
    console.error('Failed to send notification:', error);
  }

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  return NextResponse.json(
    {
      success: successful > 0,
      operation: 'create',
      results: {
        successful,
        failed,
        details: results,
      },
    } as BulkOperationResponse,
    { status: successful > 0 ? 201 : 500 }
  );
}

async function handleBulkRevoke(
  data: z.infer<typeof bulkRevokeSchema>
): Promise<NextResponse<BulkOperationResponse>> {
  const results: Array<{
    id: string;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  for (const keyId of data.apiKeyIds) {
    try {
      await db
        .update(apiKeys)
        .set({
          isActive: false,
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, keyId));

      results.push({
        id: keyId,
        status: 'success',
      });
    } catch (error) {
      console.error(`Failed to revoke key ${keyId}:`, error);
      results.push({
        id: keyId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  return NextResponse.json(
    {
      success: successful > 0,
      operation: 'revoke',
      results: {
        successful,
        failed,
        details: results,
      },
    } as BulkOperationResponse,
    { status: 200 }
  );
}

async function handleBulkUpdate(
  data: z.infer<typeof bulkUpdateSchema>
): Promise<NextResponse<BulkOperationResponse>> {
  const results: Array<{
    id: string;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  // Prepare update object (only include fields that are actually being updated)
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.updates.requestsPerMinute !== undefined) {
    updateData.requestsPerMinute = data.updates.requestsPerMinute;
  }
  if (data.updates.requestsPerDay !== undefined) {
    updateData.requestsPerDay = data.updates.requestsPerDay;
  }
  if (data.updates.tokensPerDay !== undefined) {
    updateData.tokensPerDay = data.updates.tokensPerDay;
  }
  if (data.updates.monthlySpendLimitUsd !== undefined) {
    updateData.monthlySpendLimitUsd = data.updates.monthlySpendLimitUsd;
  }
  if (data.updates.isActive !== undefined) {
    updateData.isActive = data.updates.isActive;
    if (!data.updates.isActive) {
      updateData.revokedAt = new Date();
    }
  }

  for (const keyId of data.apiKeyIds) {
    try {
      await db
        .update(apiKeys)
        .set(updateData)
        .where(eq(apiKeys.id, keyId));

      results.push({
        id: keyId,
        status: 'success',
      });
    } catch (error) {
      console.error(`Failed to update key ${keyId}:`, error);
      results.push({
        id: keyId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  return NextResponse.json(
    {
      success: successful > 0,
      operation: 'update',
      results: {
        successful,
        failed,
        details: results,
      },
    } as BulkOperationResponse,
    { status: 200 }
  );
}
