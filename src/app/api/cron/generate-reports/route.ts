import { NextRequest, NextResponse } from 'next/server';
import { generateReport, sendReportEmail, sendReportSlack, sendReportDiscord } from '@/lib/reports/generator';
import { db } from '@/lib/db';
import { admins } from '@/lib/db/schema';
import { type ReportFrequency } from '@/lib/reports/templates';

interface ReportDeliveryResult {
  admin: string;
  channel: string;
  success: boolean;
  error?: string;
}

/**
 * POST /api/cron/generate-reports
 * Cron job to generate and send scheduled reports
 *
 * Query params:
 * - frequency: daily | weekly | monthly (required)
 * - Authorization: Bearer <CRON_SECRET> (required for security)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    // Get frequency from query params
    const { searchParams } = new URL(request.url);
    const frequency = searchParams.get('frequency') as ReportFrequency;

    if (!frequency || !['daily', 'weekly', 'monthly'].includes(frequency)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid frequency. Must be daily, weekly, or monthly',
        },
        { status: 400 }
      );
    }

    console.log(`[Cron] Starting ${frequency} report generation...`);

    // Generate the report data
    const reportData = await generateReport(frequency);

    console.log(`[Cron] Report generated for period: ${reportData.period.label}`);
    console.log(`[Cron] Summary: ${reportData.summary.totalRequests} requests, $${(reportData.summary.totalCost / 100).toFixed(2)} cost`);

    // Get all admins who have notification settings enabled
    const adminList = await db
      .select({
        id: admins.id,
        email: admins.email,
        permissions: admins.permissions,
      })
      .from(admins);

    const results: ReportDeliveryResult[] = [];

    // Send reports to each admin based on their notification preferences
    for (const admin of adminList) {
      const permissions = admin.permissions as Record<string, unknown> | null;

      // Skip if admin doesn't have notification settings
      if (!permissions || typeof permissions !== 'object') {
        continue;
      }

      // Check if admin has enabled this frequency
      const reportFrequencies = Array.isArray(permissions.reportFrequencies)
        ? permissions.reportFrequencies
        : [];
      if (!reportFrequencies.includes(frequency)) {
        console.log(`[Cron] Admin ${admin.email} has not enabled ${frequency} reports`);
        continue;
      }

      // Send email report
      const emailNotificationsEnabled = Boolean(permissions.emailNotificationsEnabled);
      const notificationEmail =
        typeof permissions.notificationEmail === 'string' ? permissions.notificationEmail : null;
      if (emailNotificationsEnabled && notificationEmail) {
        console.log(`[Cron] Sending email report to ${notificationEmail}`);
        const result = await sendReportEmail(
          notificationEmail,
          reportData,
          frequency
        );
        results.push({
          admin: admin.email,
          channel: 'email',
          ...result,
        });
      }

      // Send Slack report
      const slackWebhookUrl =
        typeof permissions.slackWebhookUrl === 'string' ? permissions.slackWebhookUrl : null;
      if (slackWebhookUrl) {
        console.log(`[Cron] Sending Slack report to ${admin.email}'s webhook`);
        const result = await sendReportSlack(
          slackWebhookUrl,
          reportData,
          frequency
        );
        results.push({
          admin: admin.email,
          channel: 'slack',
          ...result,
        });
      }

      // Send Discord report
      const discordWebhookUrl =
        typeof permissions.discordWebhookUrl === 'string' ? permissions.discordWebhookUrl : null;
      if (discordWebhookUrl) {
        console.log(`[Cron] Sending Discord report to ${admin.email}'s webhook`);
        const result = await sendReportDiscord(
          discordWebhookUrl,
          reportData,
          frequency
        );
        results.push({
          admin: admin.email,
          channel: 'discord',
          ...result,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[Cron] Report generation complete. Sent: ${successCount}, Failed: ${failureCount}`);

    return NextResponse.json(
      {
        success: true,
        message: `Generated ${frequency} report and sent to ${results.length} channels`,
        report: {
          period: reportData.period.label,
          summary: reportData.summary,
          alerts: reportData.alerts,
        },
        delivery: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          results: results.map(r => ({
            admin: r.admin,
            channel: r.channel,
            success: r.success,
            error: r.error,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cron] Error generating reports:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate reports',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/generate-reports
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Report generation cron job is healthy',
    availableFrequencies: ['daily', 'weekly', 'monthly'],
  });
}
