import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { detectAnomalies } from '@/lib/analytics/anomaly-detection';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { eq } from 'drizzle-orm';

type Severity = 'low' | 'medium' | 'high' | 'critical';

const severityOrder: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ANALYTICS_VIEW);
    if (!authResult.authorized) return authResult.response;

    const lookbackDays = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get('lookbackDays') || '7', 10), 1),
      90
    );

    const globalAnomalies = await detectAnomalies(null, lookbackDays);
    const activeKeys = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
      })
      .from(apiKeys)
      .where(eq(apiKeys.isActive, true))
      .limit(20);

    const keyAnomalies = await Promise.all(
      activeKeys.map(async (key) => {
        const anomalies = await detectAnomalies(key.id, lookbackDays);
        return anomalies.map((anomaly) => ({
          ...anomaly,
          apiKey: {
            id: key.id,
            keyPrefix: key.keyPrefix,
            name: key.name,
          },
        }));
      })
    );

    const anomalies = [...globalAnomalies, ...keyAnomalies.flat()]
      .sort((left, right) => {
        const severityDiff = severityOrder[right.severity] - severityOrder[left.severity];
        if (severityDiff !== 0) return severityDiff;

        return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
      });

    return NextResponse.json({
      success: true,
      data: {
        lookbackDays,
        anomalies,
        summary: {
          total: anomalies.length,
          critical: anomalies.filter((anomaly) => anomaly.severity === 'critical').length,
          high: anomalies.filter((anomaly) => anomaly.severity === 'high').length,
          medium: anomalies.filter((anomaly) => anomaly.severity === 'medium').length,
          low: anomalies.filter((anomaly) => anomaly.severity === 'low').length,
        },
      },
    });
  } catch (error) {
    console.error('[Anomalies] Failed to detect anomalies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to detect anomalies',
      },
      { status: 500 }
    );
  }
}
