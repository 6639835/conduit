import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decryptApiKey } from '@/lib/utils/crypto';
import { SystemNotifications } from '@/lib/notifications';
import { auth } from '@/lib/auth';

/**
 * POST /api/admin/providers/[id]/test - Test provider connection
 * Makes an actual API call to verify provider is working
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch provider
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, id))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      );
    }

    // Decrypt API key
    const apiKey = await decryptApiKey(provider.apiKey);

    // Make a test request to the provider
    const testUrl = `${provider.endpoint}/v1/messages`;
    const startTime = Date.now();

    try {
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Hi',
            },
          ],
        }),
      });

      const latency = Date.now() - startTime;

      // Check if response is successful (200-299) or if it's a specific expected error
      const isHealthy = response.ok || response.status === 400; // 400 might be due to message format, but endpoint is reachable

      // Track previous status to detect status changes
      const previousStatus = provider.status;

      // Update provider status
      await db
        .update(providers)
        .set({
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastTestedAt: new Date(),
        })
        .where(eq(providers.id, id));

      // Send notifications on status changes
      const session = await auth();
      if (previousStatus !== (isHealthy ? 'healthy' : 'unhealthy')) {
        if (!isHealthy) {
          // Provider became unhealthy - notify all admins (null adminId)
          await SystemNotifications.providerUnhealthy(
            null,
            provider.name,
            provider.id
          ).catch(err => console.error('Failed to send notification:', err));
        } else if (previousStatus === 'unhealthy') {
          // Provider was restored - notify all admins
          await SystemNotifications.providerRestored(
            null,
            provider.name,
            provider.id
          ).catch(err => console.error('Failed to send notification:', err));
        }
      }

      return NextResponse.json({
        success: true,
        status: isHealthy ? 'healthy' : 'unhealthy',
        latency,
        httpStatus: response.status,
      });
    } catch (error) {
      // Connection failed
      const previousStatus = provider.status;

      await db
        .update(providers)
        .set({
          status: 'unhealthy',
          lastTestedAt: new Date(),
        })
        .where(eq(providers.id, id));

      // Send notification if provider status changed
      if (previousStatus !== 'unhealthy') {
        await SystemNotifications.providerUnhealthy(
          null,
          provider.name,
          provider.id
        ).catch(err => console.error('Failed to send notification:', err));
      }

      return NextResponse.json({
        success: true,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  } catch (error) {
    console.error('Error testing provider:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test provider' },
      { status: 500 }
    );
  }
}
