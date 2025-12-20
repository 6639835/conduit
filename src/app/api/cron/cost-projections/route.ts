import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { calculateCostProjection } from '@/lib/analytics/projections';
import { SystemNotifications } from '@/lib/notifications';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

// GET /api/cron/cost-projections - Check cost projections and send alerts
// This should be called daily by a cron service
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active keys with spend limits
    const keysWithLimits = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.isActive, true));

    let alertsSent = 0;

    // Check each key's cost projection
    for (const key of keysWithLimits) {
      if (!key.monthlySpendLimitUsd) continue;

      try {
        const projections = await calculateCostProjection(key.id);

        // Check if projected spend exceeds 80% of limit
        const limit = Number(key.monthlySpendLimitUsd);
        const projected = projections.projectedMonthlySpend;
        const percentageOfLimit = (projected / limit) * 100;

        if (percentageOfLimit >= 80 && key.createdBy) {
          await SystemNotifications.costProjectionAlert(
            key.createdBy,
            key.name || key.keyPrefix,
            projected,
            limit
          );
          alertsSent++;
        }
      } catch (error) {
        console.error(`Failed to check projections for key ${key.id}:`, error);
      }
    }

    console.log(`Cost projection check: Checked ${keysWithLimits.length} keys, sent ${alertsSent} alerts`);

    return NextResponse.json({
      success: true,
      keysChecked: keysWithLimits.length,
      alertsSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cost projection check failed:', error);
    return NextResponse.json(
      { error: 'Cost projection check failed' },
      { status: 500 }
    );
  }
}
