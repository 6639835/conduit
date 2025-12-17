import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, usageAggregates } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { SystemNotifications } from '@/lib/notifications';
import { kv } from '@vercel/kv';

// Vercel Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/monitor-quotas
 * Monitors API key quotas and sends notifications when approaching limits
 *
 * This endpoint should be called by a cron job (e.g., every hour)
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/monitor-quotas",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if configured
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentMonth = now.toISOString().slice(0, 7);

    const results = {
      checked: 0,
      quotaWarnings: 0,
      spendWarnings: 0,
    };

    // Get all active API keys
    const activeKeys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.isActive, true));

    for (const key of activeKeys) {
      results.checked++;

      // Check daily token quota
      if (key.tokensPerDay) {
        const dailyLimit = Number(key.tokensPerDay);
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);

        const [aggregate] = await db
          .select({
            totalTokensInput: usageAggregates.totalTokensInput,
            totalTokensOutput: usageAggregates.totalTokensOutput,
          })
          .from(usageAggregates)
          .where(
            and(
              eq(usageAggregates.apiKeyId, key.id),
              eq(usageAggregates.period, 'day'),
              gte(usageAggregates.periodStart, todayStart)
            )
          )
          .limit(1);

        if (aggregate) {
          const tokensUsed = Number(aggregate.totalTokensInput) + Number(aggregate.totalTokensOutput);
          const usagePercent = (tokensUsed / dailyLimit) * 100;

          // Send warning at 80% and 90% thresholds
          const threshold = usagePercent >= 90 ? 90 : usagePercent >= 80 ? 80 : null;
          if (threshold && key.createdBy) {
            const notificationKey = `quota-notification:${key.id}:${today}:${threshold}`;
            const alreadySent = await kv.get(notificationKey);

            if (!alreadySent) {
              await SystemNotifications.apiKeyQuotaWarning(
                key.createdBy,
                key.keyPrefix,
                threshold
              );
              await kv.set(notificationKey, true, { ex: 86400 }); // Expire in 24 hours
              results.quotaWarnings++;
            }
          }
        }
      }

      // Check monthly spend limit
      if (key.monthlySpendLimitUsd && key.monthlySpendLimitUsd > 0) {
        const monthStart = new Date(currentMonth + '-01');
        monthStart.setHours(0, 0, 0, 0);

        const [monthAggregate] = await db
          .select({
            totalCostUsd: usageAggregates.totalCostUsd,
          })
          .from(usageAggregates)
          .where(
            and(
              eq(usageAggregates.apiKeyId, key.id),
              eq(usageAggregates.period, 'month'),
              gte(usageAggregates.periodStart, monthStart)
            )
          )
          .limit(1);

        if (monthAggregate) {
          const monthlySpend = Number(monthAggregate.totalCostUsd) / 100; // Convert from cents to USD
          const spendPercent = (monthlySpend / key.monthlySpendLimitUsd) * 100;

          // Send warning at 90% threshold or when limit is reached
          if (spendPercent >= 90 && key.createdBy) {
            const notificationKey = `spend-notification:${key.id}:${currentMonth}:${spendPercent >= 100 ? 'reached' : '90'}`;
            const alreadySent = await kv.get(notificationKey);

            if (!alreadySent) {
              if (spendPercent >= 100) {
                await SystemNotifications.spendLimitReached(
                  key.createdBy,
                  key.keyPrefix,
                  key.monthlySpendLimitUsd
                );
              } else {
                await SystemNotifications.apiKeyQuotaWarning(
                  key.createdBy,
                  key.keyPrefix,
                  90
                );
              }
              await kv.set(notificationKey, true, { ex: 2592000 }); // Expire in 30 days
              results.spendWarnings++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Quota monitoring completed',
      results,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Error monitoring quotas:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to monitor quotas' },
      { status: 500 }
    );
  }
}

// Also support GET for manual triggering (with auth)
export async function GET(request: NextRequest) {
  return POST(request);
}
