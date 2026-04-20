import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { webhookConfigurations, webhookDeliveryLogs } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission, Role } from '@/lib/auth/rbac';
import { createHmac } from 'crypto';

interface TestWebhookResponse {
  success: boolean;
  deliveryLog?: typeof webhookDeliveryLogs.$inferSelect;
  error?: string;
}

/**
 * POST /api/admin/webhooks/[id]/test - Test webhook delivery
 * Requires authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.WEBHOOK_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const whereClause =
      authResult.adminContext.role === Role.SUPER_ADMIN
        ? eq(webhookConfigurations.id, id)
        : authResult.adminContext.organizationId
          ? and(
              eq(webhookConfigurations.id, id),
              eq(webhookConfigurations.organizationId, authResult.adminContext.organizationId)
            )
          : sql`false`;

    // Get webhook configuration
    const [webhook] = await db
      .select()
      .from(webhookConfigurations)
      .where(whereClause)
      .limit(1);

    if (!webhook) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook not found',
        } as TestWebhookResponse,
        { status: 404 }
      );
    }

    // Create test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Conduit API Gateway',
        webhookId: webhook.id,
        webhookName: webhook.name,
      },
    };

    // Send webhook
    const startTime = Date.now();
    let responseStatus = 0;
    let responseBody = '';
    let errorMessage: string | null = null;
    let status: 'success' | 'failed' = 'success';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Conduit-Webhook/1.0',
        ...((webhook.headers as Record<string, string>) || {}),
      };

      // Add HMAC signature if secret is configured
      if (webhook.secret) {
        const signature = createHmac('sha256', webhook.secret)
          .update(JSON.stringify(testPayload))
          .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(webhook.timeout || 5000),
      });

      responseStatus = response.status;
      responseBody = await response.text();

      if (!response.ok) {
        status = 'failed';
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      status = 'failed';
      responseStatus = 0;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    const responseTime = Date.now() - startTime;

    // Log the delivery
    const [deliveryLog] = await db
      .insert(webhookDeliveryLogs)
      .values({
        webhookConfigurationId: webhook.id,
        event: 'webhook.test',
        payload: testPayload,
        requestUrl: webhook.url,
        requestMethod: 'POST',
        requestHeaders: webhook.headers,
        requestBody: testPayload,
        responseStatus,
        responseBody: responseBody.substring(0, 1000), // Limit to 1000 chars
        responseTime,
        status,
        attemptNumber: 1,
        errorMessage,
        deliveredAt: status === 'success' ? new Date() : null,
      })
      .returning();

    // Update webhook stats
    await db
      .update(webhookConfigurations)
      .set({
        lastTriggeredAt: new Date(),
        lastSuccessAt: status === 'success' ? new Date() : webhook.lastSuccessAt,
        lastFailureAt: status === 'failed' ? new Date() : webhook.lastFailureAt,
        failureCount: status === 'failed' ? (webhook.failureCount || 0) + 1 : webhook.failureCount,
      })
      .where(whereClause);

    return NextResponse.json(
      {
        success: status === 'success',
        deliveryLog,
        error: errorMessage || undefined,
      } as TestWebhookResponse,
      { status: status === 'success' ? 200 : 500 }
    );
  } catch (error) {
    console.error('Error testing webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test webhook',
      } as TestWebhookResponse,
      { status: 500 }
    );
  }
}
