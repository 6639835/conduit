import { NextRequest, NextResponse } from 'next/server';
import { calculateCostProjection } from '@/lib/analytics/projections';
import { checkAuth } from '@/lib/auth/middleware';

export const runtime = 'edge';

// GET /api/admin/analytics/projections - Get cost projections
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

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
