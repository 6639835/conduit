import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { responseCache } from '@/lib/db/schema';
import { lt } from 'drizzle-orm';

export const runtime = 'edge';

// GET /api/cron/cleanup-cache - Clean up expired cache entries
// This should be called periodically (e.g., every hour) by a cron service like Vercel Cron
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Delete expired cache entries
    const result = await db
      .delete(responseCache)
      .where(lt(responseCache.expiresAt, now))
      .returning({ id: responseCache.id });

    const deletedCount = result.length;

    console.log(`Cache cleanup: Deleted ${deletedCount} expired entries`);

    return NextResponse.json({
      success: true,
      deletedCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Cache cleanup failed:', error);
    return NextResponse.json(
      { error: 'Cache cleanup failed' },
      { status: 500 }
    );
  }
}
