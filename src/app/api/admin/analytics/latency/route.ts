import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { calculateLatencyStats } from '@/lib/analytics/projections';

export const runtime = 'edge';

// GET /api/admin/analytics/latency - Get latency statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get('apiKeyId');
    const days = parseInt(searchParams.get('days') || '7', 10);

    const statistics = await calculateLatencyStats(apiKeyId || '', days);

    return NextResponse.json({
      statistics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get latency statistics:', error);
    return NextResponse.json(
      { error: 'Failed to get latency statistics' },
      { status: 500 }
    );
  }
}
