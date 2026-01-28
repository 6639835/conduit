/**
 * Multi-Region Management API
 * Get regional information, latency stats, and optimal region selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import {
  REGIONS,
  getUserLocation,
  findNearestRegion,
  getProvidersInRegion,
  getFailoverProviders,
} from '@/lib/proxy/multi-region';

/**
 * GET /api/admin/regions
 * List all available regions with details
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.PROVIDER_READ);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Get user location for nearest region calculation
    if (action === 'nearest') {
      const ip = searchParams.get('ip') || request.headers.get('x-forwarded-for') || '0.0.0.0';
      const userLoc = await getUserLocation(ip);
      const nearestRegion = findNearestRegion(userLoc.lat, userLoc.lng);

      return NextResponse.json({
        success: true,
        data: {
          userLocation: userLoc,
          nearestRegion,
          regionDetails: REGIONS[nearestRegion],
        },
      });
    }

    // Get providers in a specific region
    if (action === 'providers') {
      const region = searchParams.get('region');
      if (!region) {
        return NextResponse.json(
          { success: false, error: 'region parameter required' },
          { status: 400 }
        );
      }

      const regionProviders = await getProvidersInRegion(region, true);

      return NextResponse.json({
        success: true,
        data: {
          region,
          regionDetails: REGIONS[region],
          providers: regionProviders,
        },
      });
    }

    // Get failover regions
    if (action === 'failover') {
      const region = searchParams.get('region');
      const maxLatency = parseInt(searchParams.get('maxLatency') || '100');

      if (!region) {
        return NextResponse.json(
          { success: false, error: 'region parameter required' },
          { status: 400 }
        );
      }

      const failoverRegions = await getFailoverProviders(region, maxLatency);

      return NextResponse.json({
        success: true,
        data: {
          primaryRegion: region,
          failoverRegions: failoverRegions.map(code => ({
            ...REGIONS[code],
          })),
        },
      });
    }

    // Default: return all regions
    const regionsArray = Object.values(REGIONS).map(region => ({
      ...region,
      providerCount: 0, // This would be populated from DB
    }));

    return NextResponse.json({
      success: true,
      data: {
        regions: regionsArray,
        totalRegions: regionsArray.length,
      },
    });
  } catch (error) {
    console.error('[Regions] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get region information',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
