import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/auth/middleware';
import { z } from 'zod';

const updateAlertThresholdsSchema = z.object({
  requestsPerDay: z.array(z.number().min(0).max(100)).optional(),
  tokensPerDay: z.array(z.number().min(0).max(100)).optional(),
  monthlySpend: z.array(z.number().min(0).max(100)).optional(),
});

interface AlertThresholdsResponse {
  success: boolean;
  alertThresholds?: {
    requestsPerDay?: number[];
    tokensPerDay?: number[];
    monthlySpend?: number[];
  };
  error?: string;
}

/**
 * GET /api/admin/keys/[id]/alert-thresholds - Get alert thresholds for an API key
 * Requires authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;

    // Get the API key
    const [apiKey] = await db
      .select({
        alertThresholds: apiKeys.alertThresholds,
      })
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        } as AlertThresholdsResponse,
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        alertThresholds: apiKey.alertThresholds as {
          requestsPerDay?: number[];
          tokensPerDay?: number[];
          monthlySpend?: number[];
        },
      } as AlertThresholdsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting alert thresholds:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get alert thresholds',
      } as AlertThresholdsResponse,
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/keys/[id]/alert-thresholds - Update alert thresholds for an API key
 * Requires authentication
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateAlertThresholdsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as AlertThresholdsResponse,
        { status: 400 }
      );
    }

    const newThresholds = validationResult.data;

    // Get existing key to merge thresholds
    const [existingKey] = await db
      .select({
        alertThresholds: apiKeys.alertThresholds,
      })
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!existingKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        } as AlertThresholdsResponse,
        { status: 404 }
      );
    }

    // Merge with existing thresholds
    const currentThresholds = (existingKey.alertThresholds || {}) as {
      requestsPerDay?: number[];
      tokensPerDay?: number[];
      monthlySpend?: number[];
    };

    const updatedThresholds = {
      requestsPerDay: newThresholds.requestsPerDay ?? currentThresholds.requestsPerDay ?? [80, 90],
      tokensPerDay: newThresholds.tokensPerDay ?? currentThresholds.tokensPerDay ?? [80, 90],
      monthlySpend: newThresholds.monthlySpend ?? currentThresholds.monthlySpend ?? [80, 90],
    };

    // Update in database
    await db
      .update(apiKeys)
      .set({
        alertThresholds: updatedThresholds,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id));

    return NextResponse.json(
      {
        success: true,
        alertThresholds: updatedThresholds,
      } as AlertThresholdsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating alert thresholds:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update alert thresholds',
      } as AlertThresholdsResponse,
      { status: 500 }
    );
  }
}
