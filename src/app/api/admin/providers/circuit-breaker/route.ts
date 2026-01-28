import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { db } from '@/lib/db';
import { providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  getAllCircuitBreakerStatuses,
  resetCircuitBreaker,
  openCircuitBreaker,
  calculateHealthMetrics,
} from '@/lib/proxy/circuit-breaker';
import { z } from 'zod';

/**
 * GET /api/admin/providers/circuit-breaker
 * Get circuit breaker status for all providers
 *
 * Permission: PROVIDER_READ
 */
export async function GET(_request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.PROVIDER_READ);
    if (!authResult.authorized) return authResult.response;

    // Get all providers
    const allProviders = await db
      .select({
        id: providers.id,
        name: providers.name,
        type: providers.type,
        endpoint: providers.endpoint,
        isActive: providers.isActive,
        status: providers.status,
      })
      .from(providers);

    // Get circuit breaker statuses
    const statuses = await getAllCircuitBreakerStatuses(
      allProviders.map(p => ({ id: p.id, name: p.name }))
    );

    // Calculate health metrics
    const statusesWithMetrics = statuses.map(status => {
      const provider = allProviders.find(p => p.id === status.providerId);
      const metrics = calculateHealthMetrics(status);

      return {
        ...status,
        providerType: provider?.type,
        providerEndpoint: provider?.endpoint,
        providerIsActive: provider?.isActive,
        providerStatus: provider?.status,
        metrics,
      };
    });

    // Calculate summary stats
    const summary = {
      totalProviders: statusesWithMetrics.length,
      closed: statusesWithMetrics.filter(s => s.state === 'CLOSED').length,
      open: statusesWithMetrics.filter(s => s.state === 'OPEN').length,
      halfOpen: statusesWithMetrics.filter(s => s.state === 'HALF_OPEN').length,
      averageHealthScore:
        statusesWithMetrics.reduce((sum, s) => sum + s.metrics.healthScore, 0) /
        (statusesWithMetrics.length || 1),
      totalRequests: statusesWithMetrics.reduce((sum, s) => sum + s.totalRequests, 0),
      totalFailures: statusesWithMetrics.reduce((sum, s) => sum + s.totalFailures, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        providers: statusesWithMetrics,
        summary,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching circuit breaker status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch circuit breaker status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

const circuitBreakerActionSchema = z.object({
  providerId: z.string().uuid(),
  action: z.enum(['reset', 'open']),
});

/**
 * POST /api/admin/providers/circuit-breaker
 * Manually control circuit breaker state
 *
 * Body:
 * - providerId: UUID of provider
 * - action: 'reset' (force CLOSED) or 'open' (force OPEN)
 *
 * Permission: PROVIDER_UPDATE
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.PROVIDER_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validation = circuitBreakerActionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { providerId, action } = validation.data;

    // Verify provider exists
    const [provider] = await db
      .select({
        id: providers.id,
        name: providers.name,
      })
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provider not found',
        },
        { status: 404 }
      );
    }

    // Perform action
    if (action === 'reset') {
      await resetCircuitBreaker(providerId);
    } else if (action === 'open') {
      await openCircuitBreaker(providerId);
    }

    return NextResponse.json({
      success: true,
      message: `Circuit breaker ${action === 'reset' ? 'reset' : 'opened'} for provider ${provider.name}`,
      data: {
        providerId,
        action,
      },
    });
  } catch (error) {
    console.error('[API] Error controlling circuit breaker:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to control circuit breaker',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
