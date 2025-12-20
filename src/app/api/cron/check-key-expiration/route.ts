import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { and, isNotNull, lte, gte } from 'drizzle-orm';
import { SystemNotifications } from '@/lib/notifications';

export const runtime = 'edge';

// GET /api/cron/check-key-expiration - Check for keys expiring soon and send notifications
// This should be called daily by a cron service
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find keys expiring in the next 7 days
    const expiringKeys = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          isNotNull(apiKeys.expiresAt),
          gte(apiKeys.expiresAt, now),
          lte(apiKeys.expiresAt, sevenDaysFromNow),
          apiKeys.isActive
        )
      );

    let notificationsSent = 0;

    // Send notifications for each expiring key
    for (const key of expiringKeys) {
      if (key.expiresAt && key.createdBy) {
        try {
          await SystemNotifications.apiKeyExpiringSoon(
            key.createdBy,
            key.name || key.keyPrefix,
            key.expiresAt
          );
          notificationsSent++;
        } catch (error) {
          console.error(`Failed to send notification for key ${key.id}:`, error);
        }
      }
    }

    console.log(`Key expiration check: Found ${expiringKeys.length} keys, sent ${notificationsSent} notifications`);

    return NextResponse.json({
      success: true,
      keysFound: expiringKeys.length,
      notificationsSent,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Key expiration check failed:', error);
    return NextResponse.json(
      { error: 'Key expiration check failed' },
      { status: 500 }
    );
  }
}
