import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decryptApiKey } from '@/lib/utils/crypto';
import { SystemNotifications } from '@/lib/notifications';

// Vercel Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/monitor-providers
 * Monitors provider health and sends notifications for status changes
 *
 * This endpoint should be called by a cron job (e.g., every 5 minutes)
 * Configure in vercel.json with schedule: "every 5 minutes"
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');

    if (!CRON_SECRET) {
      console.error('CRON_SECRET environment variable is not configured');
      return NextResponse.json(
        { success: false, error: 'Service misconfigured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const results = {
      tested: 0,
      healthy: 0,
      unhealthy: 0,
      notifications: 0,
    };

    // Get all active providers
    const activeProviders = await db
      .select()
      .from(providers)
      .where(eq(providers.isActive, true));

    for (const provider of activeProviders) {
      results.tested++;
      const previousStatus = provider.status;

      try {
        // Decrypt API key
        const apiKey = await decryptApiKey(provider.apiKey);

        // Make a test request to the provider based on provider type
        const testUrl = provider.type === 'codex' || provider.type === 'openai'
          ? `${provider.endpoint}/v1/models`
          : provider.type === 'gemini'
          ? `${provider.endpoint}/v1/models`
          : `${provider.endpoint}/v1/messages`;

        const response = await fetch(testUrl, provider.type === 'codex' || provider.type === 'openai'
          ? {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
              signal: AbortSignal.timeout(10000), // 10 second timeout
            }
          : provider.type === 'gemini'
          ? {
              method: 'GET',
              headers: {
                'x-goog-api-key': apiKey,
              },
              signal: AbortSignal.timeout(10000), // 10 second timeout
            }
          : {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': apiKey,
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
              signal: AbortSignal.timeout(10000), // 10 second timeout
            });

        const isHealthy = response.ok || response.status === 400;

        // Update provider status
        await db
          .update(providers)
          .set({
            status: isHealthy ? 'healthy' : 'unhealthy',
            lastTestedAt: new Date(),
          })
          .where(eq(providers.id, provider.id));

        if (isHealthy) {
          results.healthy++;

          // Send notification if provider was restored
          if (previousStatus === 'unhealthy') {
            await SystemNotifications.providerRestored(
              null,
              provider.name,
              provider.id
            );
            results.notifications++;
          }
        } else {
          results.unhealthy++;

          // Send notification if provider became unhealthy
          if (previousStatus !== 'unhealthy') {
            await SystemNotifications.providerUnhealthy(
              null,
              provider.name,
              provider.id
            );
            results.notifications++;
          }
        }
      } catch (_error) {
        // Connection failed
        results.unhealthy++;

        await db
          .update(providers)
          .set({
            status: 'unhealthy',
            lastTestedAt: new Date(),
          })
          .where(eq(providers.id, provider.id));

        // Send notification if provider status changed
        if (previousStatus !== 'unhealthy') {
          await SystemNotifications.providerUnhealthy(
            null,
            provider.name,
            provider.id
          );
          results.notifications++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Provider monitoring completed',
      results,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error monitoring providers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to monitor providers' },
      { status: 500 }
    );
  }
}

// Also support GET for manual triggering (with auth)
export async function GET(request: NextRequest) {
  return POST(request);
}
