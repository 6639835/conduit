import { NextRequest, NextResponse } from 'next/server';
import { detectAnomalies, type Anomaly } from '@/lib/analytics/anomaly-detection';
import { db } from '@/lib/db';
import { apiKeys, admins, notifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

type AdminRow = typeof admins.$inferSelect;

/**
 * Send anomaly notification via configured channels
 */
async function sendAnomalyNotification(
  admin: AdminRow,
  anomaly: Anomaly
): Promise<{ success: boolean; channels: string[] }> {
  const channels: string[] = [];
  const permissions = admin.permissions as Record<string, unknown> | null;

  if (!permissions || typeof permissions !== 'object') {
    return { success: false, channels: [] };
  }

  const message = formatAnomalyMessage(anomaly);
  const slackWebhookUrl = typeof permissions.slackWebhookUrl === 'string'
    ? permissions.slackWebhookUrl
    : null;
  const discordWebhookUrl = typeof permissions.discordWebhookUrl === 'string'
    ? permissions.discordWebhookUrl
    : null;

  // Send to Slack
  if (slackWebhookUrl) {
    try {
      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Anomaly Detected`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `🚨 ${anomaly.severity.toUpperCase()}: ${message.title}`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message.body,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Detected at: ${anomaly.timestamp.toLocaleString()}`,
                },
              ],
            },
          ],
        }),
      });
      channels.push('slack');
    } catch (error) {
      console.error('[Anomaly] Failed to send Slack notification:', error);
    }
  }

  // Send to Discord
  if (discordWebhookUrl) {
    try {
      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `🚨 ${message.title}`,
              description: message.body,
              color: getDiscordColor(anomaly.severity),
              fields: [
                {
                  name: 'Current Value',
                  value: anomaly.currentValue.toFixed(2),
                  inline: true,
                },
                {
                  name: 'Expected Value',
                  value: anomaly.expectedValue.toFixed(2),
                  inline: true,
                },
                {
                  name: 'Severity',
                  value: anomaly.severity.toUpperCase(),
                  inline: true,
                },
              ],
              timestamp: anomaly.timestamp.toISOString(),
            },
          ],
        }),
      });
      channels.push('discord');
    } catch (error) {
      console.error('[Anomaly] Failed to send Discord notification:', error);
    }
  }

  // Create in-app notification
  try {
    await db.insert(notifications).values({
      adminId: admin.id,
      type: anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'error' : 'warning',
      title: message.title,
      message: message.body,
      metadata: {
        anomalyType: anomaly.type,
        metric: anomaly.metric,
        currentValue: anomaly.currentValue,
        expectedValue: anomaly.expectedValue,
        deviation: anomaly.deviation,
        apiKeyId: anomaly.apiKeyId,
        severity: anomaly.severity,
      },
    });
    channels.push('in-app');
  } catch (error) {
    console.error('[Anomaly] Failed to create in-app notification:', error);
  }

  return { success: channels.length > 0, channels };
}

/**
 * Format anomaly message for notifications
 */
function formatAnomalyMessage(anomaly: Anomaly): { title: string; body: string } {
  const title = anomaly.message;

  let body = `**Type:** ${anomaly.type.replace(/_/g, ' ')}\n`;
  body += `**Metric:** ${anomaly.metric}\n`;
  body += `**Current:** ${anomaly.currentValue.toFixed(2)}\n`;
  body += `**Expected:** ${anomaly.expectedValue.toFixed(2)}\n`;
  body += `**Deviation:** ${anomaly.deviation.toFixed(2)} standard deviations\n`;

  if (anomaly.details.percentageChange) {
    body += `**Change:** ${anomaly.details.percentageChange.toFixed(1)}%\n`;
  }

  if (anomaly.apiKeyId) {
    body += `**API Key:** ${anomaly.apiKeyId}\n`;
  }

  return { title, body };
}

/**
 * Get Discord embed color based on severity
 */
function getDiscordColor(severity: string): number {
  switch (severity) {
    case 'critical':
      return 0xdc2626; // Red
    case 'high':
      return 0xf97316; // Orange
    case 'medium':
      return 0xeab308; // Yellow
    case 'low':
      return 0x3b82f6; // Blue
    default:
      return 0x6b7280; // Gray
  }
}

/**
 * POST /api/cron/detect-anomalies
 * Cron job to detect anomalies and send alerts
 *
 * Query params:
 * - lookbackDays: number of days to analyze (default: 7)
 * - Authorization: Bearer <CRON_SECRET> (required)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('CRON_SECRET environment variable is not configured');
      return NextResponse.json(
        { success: false, error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }
    const expectedAuth = `Bearer ${cronSecret}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const lookbackDays = parseInt(searchParams.get('lookbackDays') || '7');

    console.log(`[Cron] Starting anomaly detection (${lookbackDays} days lookback)...`);

    // Detect global anomalies
    const globalAnomalies = await detectAnomalies(null, lookbackDays);

    console.log(`[Cron] Found ${globalAnomalies.length} global anomalies`);

    // Detect anomalies per API key (top active keys only)
    const activeKeys = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
      })
      .from(apiKeys)
      .where(eq(apiKeys.isActive, true))
      .limit(20); // Check top 20 active keys

    const perKeyAnomalies: Anomaly[] = [];

    for (const key of activeKeys) {
      const anomalies = await detectAnomalies(key.id, lookbackDays);
      if (anomalies.length > 0) {
        console.log(`[Cron] Found ${anomalies.length} anomalies for key ${key.keyPrefix}`);
        perKeyAnomalies.push(...anomalies);
      }
    }

    const allAnomalies = [...globalAnomalies, ...perKeyAnomalies];

    // Filter to only critical and high severity anomalies for notifications
    const criticalAnomalies = allAnomalies.filter(
      a => a.severity === 'critical' || a.severity === 'high'
    );

    console.log(`[Cron] ${criticalAnomalies.length} critical/high severity anomalies to notify`);

    // Send notifications to all admins
    const adminList = await db.select().from(admins);

    const notificationResults: Array<{
      admin: string | null;
      anomaly: Anomaly['type'];
      severity: Anomaly['severity'];
      channels: string[];
    }> = [];

    for (const anomaly of criticalAnomalies) {
      for (const admin of adminList) {
        const result = await sendAnomalyNotification(admin, anomaly);
        notificationResults.push({
          admin: admin.email,
          anomaly: anomaly.type,
          severity: anomaly.severity,
          channels: result.channels,
        });
      }
    }

    const summary = {
      totalAnomalies: allAnomalies.length,
      bySeverity: {
        critical: allAnomalies.filter(a => a.severity === 'critical').length,
        high: allAnomalies.filter(a => a.severity === 'high').length,
        medium: allAnomalies.filter(a => a.severity === 'medium').length,
        low: allAnomalies.filter(a => a.severity === 'low').length,
      },
      byType: {
        usage_spike: allAnomalies.filter(a => a.type === 'usage_spike').length,
        cost_spike: allAnomalies.filter(a => a.type === 'cost_spike').length,
        error_rate_spike: allAnomalies.filter(a => a.type === 'error_rate_spike').length,
        usage_drop: allAnomalies.filter(a => a.type === 'usage_drop').length,
      },
      notificationsSent: notificationResults.length,
    };

    console.log('[Cron] Anomaly detection complete:', summary);

    return NextResponse.json(
      {
        success: true,
        message: 'Anomaly detection complete',
        summary,
        anomalies: allAnomalies.map(a => ({
          type: a.type,
          severity: a.severity,
          metric: a.metric,
          currentValue: a.currentValue,
          expectedValue: a.expectedValue,
          deviation: a.deviation,
          message: a.message,
          timestamp: a.timestamp,
          apiKeyId: a.apiKeyId,
        })),
        notifications: notificationResults,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cron] Error detecting anomalies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to detect anomalies',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/detect-anomalies
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Anomaly detection cron job is healthy',
  });
}
