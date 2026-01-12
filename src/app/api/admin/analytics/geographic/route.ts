import { NextRequest, NextResponse } from 'next/server';
import { getGeoUsageStats, getGlobalGeoUsageStats } from '@/lib/analytics/geo-location';
import { checkAuth } from '@/lib/auth/middleware';

export const runtime = 'edge';

/**
 * GET /api/admin/analytics/geographic
 *
 * Get geographic usage statistics
 *
 * Query params:
 * - apiKeyId (optional): Filter by API key
 * - days (optional): Number of days to analyze (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const apiKeyId = searchParams.get('apiKeyId');
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Validate days parameter
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Days must be between 1 and 365' },
        { status: 400 }
      );
    }

    let stats;

    if (apiKeyId) {
      // Get stats for specific API key
      stats = await getGeoUsageStats(apiKeyId, days);
    } else {
      // Get global stats across all keys
      stats = await getGlobalGeoUsageStats(days);
    }

    return NextResponse.json({
      success: true,
      data: stats,
      meta: {
        days,
        apiKeyId: apiKeyId || 'all',
        totalCountries: stats.length,
      },
    });
  } catch (error) {
    console.error('Error fetching geographic stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch geographic statistics' },
      { status: 500 }
    );
  }
}
