import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { calculateCostProjection } from '@/lib/analytics/projections';

export const runtime = 'edge';

// GET /api/admin/analytics/projections - Get cost projections
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get('apiKeyId');

    if (!apiKeyId) {
      return NextResponse.json(
        { error: 'apiKeyId is required' },
        { status: 400 }
      );
    }

    const projections = await calculateCostProjection(apiKeyId);

    return NextResponse.json({
      projections,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get cost projections:', error);
    return NextResponse.json(
      { error: 'Failed to get cost projections' },
      { status: 500 }
    );
  }
}
