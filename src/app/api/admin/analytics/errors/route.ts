import { NextRequest, NextResponse } from 'next/server';
import { calculateErrorRates } from '@/lib/analytics/projections';
import { checkAuth } from '@/lib/auth/middleware';

export const runtime = 'edge';

// GET /api/admin/analytics/errors - Get error rate analysis
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get('apiKeyId');
    const days = parseInt(searchParams.get('days') || '7', 10);

    const analysis = await calculateErrorRates(apiKeyId || '', days);

    return NextResponse.json({
      analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get error analysis:', error);
    return NextResponse.json(
      { error: 'Failed to get error analysis' },
      { status: 500 }
    );
  }
}
