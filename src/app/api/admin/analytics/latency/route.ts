import { NextRequest, NextResponse } from 'next/server';
import { calculateLatencyStats } from '@/lib/analytics/projections';
import { checkAuth } from '@/lib/auth/middleware';

export const runtime = 'edge';

// GET /api/admin/analytics/latency - Get latency statistics
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

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
