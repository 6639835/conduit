/**
 * GET /api/admin/routing/recommendations
 * Get intelligent routing recommendations for cost optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { generateRoutingRecommendations } from '@/lib/proxy/intelligent-routing';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_READ);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get('apiKeyId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!apiKeyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiKeyId parameter required',
        },
        { status: 400 }
      );
    }

    // Verify API key exists
    const [key] = await db
      .select({ id: apiKeys.id, name: apiKeys.name })
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId))
      .limit(1);

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        },
        { status: 404 }
      );
    }

    const recommendations = await generateRoutingRecommendations(apiKeyId, days);

    const totalSavings = recommendations.reduce(
      (sum, rec) => sum + rec.potentialSavings,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        apiKeyId,
        apiKeyName: key.name,
        analyzedDays: days,
        recommendations,
        totalPotentialSavings: totalSavings,
        monthlySavingsEstimate: (totalSavings / days) * 30,
      },
    });
  } catch (error) {
    console.error('[Routing] Error generating recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
