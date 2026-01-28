import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth/middleware';
import { calculateCostProjection, calculateBurnRate, getCostBreakdownByModel } from '@/lib/analytics/projections';
import { z } from 'zod';

const budgetQuerySchema = z.object({
  apiKeyId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  monthlyBudget: z.number().positive().optional(),
});

interface BudgetAnalyticsResponse {
  success: boolean;
  data?: {
    projection: {
      currentSpend: number;
      projectedMonthlySpend: number;
      projectedDailyAverage: number;
      trend: string;
      percentageChange: number;
      estimatedEndOfMonthSpend: number;
    };
    burnRate: {
      daily: number;
      weekly: number;
      monthly: number;
      percentageChange: number;
      daysUntilBudgetExhausted: number | null;
    };
    costBreakdown: {
      byModel: Record<string, number>;
      total: number;
    };
    alerts: Array<{
      type: 'warning' | 'error' | 'info';
      message: string;
    }>;
  };
  error?: string;
}

/**
 * GET /api/admin/analytics/budgets - Get budget analytics and forecasts
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const queryParams = {
      apiKeyId: searchParams.get('apiKeyId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      monthlyBudget: searchParams.get('monthlyBudget')
        ? parseFloat(searchParams.get('monthlyBudget')!)
        : undefined,
    };

    const validationResult = budgetQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as BudgetAnalyticsResponse,
        { status: 400 }
      );
    }

    const { apiKeyId, startDate, endDate, monthlyBudget } = validationResult.data;

    // Calculate cost projection
    const projection = apiKeyId
      ? await calculateCostProjection(apiKeyId)
      : {
          currentSpend: 0,
          projectedMonthlySpend: 0,
          projectedDailyAverage: 0,
          trend: 'stable' as const,
          percentageChange: 0,
          daysInPeriod: 0,
          estimatedEndOfMonthSpend: 0,
        };

    // Calculate burn rate
    const burnRate = apiKeyId
      ? await calculateBurnRate(apiKeyId, monthlyBudget)
      : {
          daily: 0,
          weekly: 0,
          monthly: 0,
          percentageChange: 0,
          daysUntilBudgetExhausted: null,
        };

    // Get cost breakdown
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const costBreakdown = await getCostBreakdownByModel(start, end, apiKeyId);

    // Generate alerts
    const alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string }> = [];

    // Budget exhaustion warning
    if (burnRate.daysUntilBudgetExhausted !== null) {
      if (burnRate.daysUntilBudgetExhausted === 0) {
        alerts.push({
          type: 'error',
          message: 'Monthly budget has been exceeded!',
        });
      } else if (burnRate.daysUntilBudgetExhausted <= 3) {
        alerts.push({
          type: 'error',
          message: `Budget will be exhausted in ${burnRate.daysUntilBudgetExhausted} day(s)!`,
        });
      } else if (burnRate.daysUntilBudgetExhausted <= 7) {
        alerts.push({
          type: 'warning',
          message: `Budget will be exhausted in ${burnRate.daysUntilBudgetExhausted} days`,
        });
      }
    }

    // Cost trend alert
    if (burnRate.percentageChange > 50) {
      alerts.push({
        type: 'warning',
        message: `Spending has increased by ${burnRate.percentageChange.toFixed(1)}% compared to previous week`,
      });
    } else if (burnRate.percentageChange < -50) {
      alerts.push({
        type: 'info',
        message: `Spending has decreased by ${Math.abs(burnRate.percentageChange).toFixed(1)}% compared to previous week`,
      });
    }

    // Projected overspend alert
    if (monthlyBudget && projection.estimatedEndOfMonthSpend / 100 > monthlyBudget) {
      const overspend = (projection.estimatedEndOfMonthSpend / 100) - monthlyBudget;
      alerts.push({
        type: 'warning',
        message: `Projected to exceed monthly budget by $${overspend.toFixed(2)}`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          projection,
          burnRate,
          costBreakdown,
          alerts,
        },
      } as BudgetAnalyticsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching budget analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch budget analytics',
      } as BudgetAnalyticsResponse,
      { status: 500 }
    );
  }
}
