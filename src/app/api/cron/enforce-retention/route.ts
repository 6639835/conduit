import { NextRequest, NextResponse } from 'next/server';
import { enforceRetentionPolicy } from '@/lib/compliance/retention';

/**
 * POST /api/cron/enforce-retention
 * Cron job to enforce data retention policies
 *
 * Runs daily to delete data older than retention period
 * Query params: none
 * Authorization: Bearer <CRON_SECRET> (required)
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

    console.log('[Cron] Starting data retention enforcement...');

    // Enforce retention policy for all organizations
    const result = await enforceRetentionPolicy();

    const summary = {
      totalDeleted: result.deletedRecords.usageLogs,
      errors: result.errors.length,
      errorDetails: result.errors,
    };

    console.log('[Cron] Retention enforcement complete:', summary);

    return NextResponse.json(
      {
        success: result.success,
        message: 'Data retention enforcement complete',
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cron] Error enforcing retention policy:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to enforce retention policy',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/enforce-retention
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Retention enforcement cron job is healthy',
  });
}
