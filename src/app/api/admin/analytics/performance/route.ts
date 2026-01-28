import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import {
  calculatePerformanceMetrics,
  generateSLAReport,
  getDateRange,
} from '@/lib/analytics/performance';
import { z } from 'zod';

const performanceQuerySchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  apiKeyId: z.string().uuid().optional(),
  slaTarget: z.coerce.number().min(0).max(100).default(99.9),
  latencyThreshold: z.coerce.number().min(0).default(1000),
});

/**
 * GET /api/admin/analytics/performance
 * Get performance metrics and SLA report
 *
 * Query params:
 * - period: 'hour' | 'day' | 'week' | 'month' (default: 'day')
 * - apiKeyId: Filter by API key (optional)
 * - slaTarget: SLA target percentage (default: 99.9)
 * - latencyThreshold: Max acceptable latency in ms (default: 1000)
 *
 * Permission: ANALYTICS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ANALYTICS_VIEW);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);

    const validation = performanceQuerySchema.safeParse({
      period: searchParams.get('period'),
      apiKeyId: searchParams.get('apiKeyId'),
      slaTarget: searchParams.get('slaTarget'),
      latencyThreshold: searchParams.get('latencyThreshold'),
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { period, apiKeyId, slaTarget, latencyThreshold } = validation.data;

    const { start, end, label } = getDateRange(period);

    console.log(`[Analytics] Calculating performance metrics for ${label}...`);

    // Calculate performance metrics
    const [metrics, slaReport] = await Promise.all([
      calculatePerformanceMetrics(start, end, apiKeyId, {
        target: slaTarget,
        latencyThreshold,
      }),
      generateSLAReport(start, end, apiKeyId, slaTarget),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        slaReport,
      },
    });
  } catch (error) {
    console.error('[API] Error calculating performance metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate performance metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
