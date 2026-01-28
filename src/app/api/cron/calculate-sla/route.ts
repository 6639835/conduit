import { NextRequest, NextResponse } from 'next/server';
import { generateSLAReport } from '@/lib/analytics/performance';
import { kv } from '@vercel/kv';

/**
 * POST /api/cron/calculate-sla
 * Cron job to calculate and cache SLA metrics
 *
 * Runs hourly to update SLA statistics
 * Authorization: Bearer <CRON_SECRET> (required)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
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

    console.log('[Cron] Starting SLA calculation...');

    const now = new Date();

    // Calculate SLA for last 24 hours
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dayReport = await generateSLAReport(last24Hours, now);

    // Calculate SLA for last 7 days
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekReport = await generateSLAReport(last7Days, now);

    // Calculate SLA for last 30 days
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthReport = await generateSLAReport(last30Days, now);

    // Cache results in KV
    await Promise.all([
      kv.set('sla:daily', dayReport, { ex: 3600 }), // 1 hour expiry
      kv.set('sla:weekly', weekReport, { ex: 3600 }),
      kv.set('sla:monthly', monthReport, { ex: 3600 }),
    ]);

    const summary = {
      daily: {
        uptime: dayReport.overall.uptimePercentage.toFixed(2) + '%',
        violations: dayReport.overall.violations,
        totalRequests: dayReport.overall.totalRequests,
      },
      weekly: {
        uptime: weekReport.overall.uptimePercentage.toFixed(2) + '%',
        violations: weekReport.overall.violations,
        totalRequests: weekReport.overall.totalRequests,
      },
      monthly: {
        uptime: monthReport.overall.uptimePercentage.toFixed(2) + '%',
        violations: monthReport.overall.violations,
        totalRequests: monthReport.overall.totalRequests,
      },
    };

    console.log('[Cron] SLA calculation complete:', summary);

    return NextResponse.json(
      {
        success: true,
        message: 'SLA calculation complete',
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cron] Error calculating SLA:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate SLA',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/calculate-sla
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'SLA calculation cron job is healthy',
  });
}
