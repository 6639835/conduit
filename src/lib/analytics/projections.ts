import { db } from '../db';
import { usageLogs } from '../db/schema';
import { eq, gte, and, sql } from 'drizzle-orm';

export interface CostProjection {
  currentSpend: number; // In cents
  projectedMonthlySpend: number; // In cents
  projectedDailyAverage: number; // In cents
  trend: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number; // Compared to previous period
  daysInPeriod: number;
  estimatedEndOfMonthSpend: number; // In cents
}

/**
 * Calculates cost projection for an API key
 * @param apiKeyId - The API key ID
 * @returns Cost projection data
 */
export async function calculateCostProjection(
  apiKeyId: string
): Promise<CostProjection> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  // Get current month's spending
  const currentMonthSpend = await db
    .select({
      total: sql<number>`SUM(${usageLogs.costUsd})`.as('total'),
    })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.apiKeyId, apiKeyId),
        gte(usageLogs.timestamp, startOfMonth)
      )
    );

  const currentSpend = Number(currentMonthSpend[0]?.total || 0);

  // Calculate daily average
  const dailyAverage = currentSpend / dayOfMonth;

  // Project end of month spending
  const projectedMonthlySpend = dailyAverage * daysInMonth;

  // Get previous month for trend analysis
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const previousMonthSpend = await db
    .select({
      total: sql<number>`SUM(${usageLogs.costUsd})`.as('total'),
    })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.apiKeyId, apiKeyId),
        gte(usageLogs.timestamp, startOfPreviousMonth),
        sql`${usageLogs.timestamp} <= ${endOfPreviousMonth}`
      )
    );

  const previousSpend = Number(previousMonthSpend[0]?.total || 0);

  // Calculate trend
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  let percentageChange = 0;

  if (previousSpend > 0) {
    percentageChange = ((projectedMonthlySpend - previousSpend) / previousSpend) * 100;

    if (percentageChange > 10) {
      trend = 'increasing';
    } else if (percentageChange < -10) {
      trend = 'decreasing';
    }
  } else if (currentSpend > 0) {
    trend = 'increasing';
    percentageChange = 100;
  }

  return {
    currentSpend,
    projectedMonthlySpend: Math.round(projectedMonthlySpend),
    projectedDailyAverage: Math.round(dailyAverage),
    trend,
    percentageChange: Math.round(percentageChange),
    daysInPeriod: dayOfMonth,
    estimatedEndOfMonthSpend: Math.round(projectedMonthlySpend),
  };
}

/**
 * Calculates usage trends for analytics
 * @param apiKeyId - The API key ID
 * @param days - Number of days to analyze
 * @returns Usage trend data
 */
export async function calculateUsageTrends(
  apiKeyId: string,
  days: number = 30
): Promise<{
  daily: Array<{ date: string; requests: number; cost: number; tokens: number }>;
  averageRequestsPerDay: number;
  averageCostPerDay: number;
  averageTokensPerDay: number;
  peakDay: { date: string; requests: number };
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get daily aggregates
  const dailyData = await db
    .select({
      date: sql<string>`DATE(${usageLogs.timestamp})`.as('date'),
      requests: sql<number>`COUNT(*)`.as('requests'),
      cost: sql<number>`SUM(${usageLogs.costUsd})`.as('cost'),
      tokens: sql<number>`SUM(${usageLogs.tokensInput} + ${usageLogs.tokensOutput})`.as('tokens'),
    })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.apiKeyId, apiKeyId),
        gte(usageLogs.timestamp, startDate)
      )
    )
    .groupBy(sql`DATE(${usageLogs.timestamp})`)
    .orderBy(sql`DATE(${usageLogs.timestamp})`);

  const daily = dailyData.map((d) => ({
    date: d.date,
    requests: Number(d.requests),
    cost: Number(d.cost),
    tokens: Number(d.tokens),
  }));

  // Calculate averages
  const totalRequests = daily.reduce((sum, d) => sum + d.requests, 0);
  const totalCost = daily.reduce((sum, d) => sum + d.cost, 0);
  const totalTokens = daily.reduce((sum, d) => sum + d.tokens, 0);

  const averageRequestsPerDay = Math.round(totalRequests / days);
  const averageCostPerDay = Math.round(totalCost / days);
  const averageTokensPerDay = Math.round(totalTokens / days);

  // Find peak day
  const peakDay = daily.reduce(
    (max, d) => (d.requests > max.requests ? d : max),
    { date: '', requests: 0 }
  );

  return {
    daily,
    averageRequestsPerDay,
    averageCostPerDay,
    averageTokensPerDay,
    peakDay,
  };
}

/**
 * Calculates error rates over time
 * @param apiKeyId - The API key ID
 * @param days - Number of days to analyze
 * @returns Error rate data
 */
export async function calculateErrorRates(
  apiKeyId: string,
  days: number = 7
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number; // Percentage
  errorsByCode: Array<{ statusCode: number; count: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get total and failed requests
  const stats = await db
    .select({
      total: sql<number>`COUNT(*)`.as('total'),
      successful: sql<number>`COUNT(*) FILTER (WHERE ${usageLogs.statusCode} >= 200 AND ${usageLogs.statusCode} < 300)`.as('successful'),
      failed: sql<number>`COUNT(*) FILTER (WHERE ${usageLogs.statusCode} >= 400)`.as('failed'),
    })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.apiKeyId, apiKeyId),
        gte(usageLogs.timestamp, startDate)
      )
    );

  const totalRequests = Number(stats[0]?.total || 0);
  const successfulRequests = Number(stats[0]?.successful || 0);
  const failedRequests = Number(stats[0]?.failed || 0);
  const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

  // Get errors by status code
  const errorCodes = await db
    .select({
      statusCode: usageLogs.statusCode,
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.apiKeyId, apiKeyId),
        gte(usageLogs.timestamp, startDate),
        sql`${usageLogs.statusCode} >= 400`
      )
    )
    .groupBy(usageLogs.statusCode)
    .orderBy(sql`COUNT(*) DESC`);

  const errorsByCode = errorCodes.map((e) => ({
    statusCode: Number(e.statusCode),
    count: Number(e.count),
  }));

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    errorRate: Math.round(errorRate * 100) / 100,
    errorsByCode,
  };
}

/**
 * Calculates latency statistics
 * @param apiKeyId - The API key ID
 * @param days - Number of days to analyze
 * @returns Latency statistics
 */
export async function calculateLatencyStats(
  apiKeyId: string,
  days: number = 7
): Promise<{
  averageLatencyMs: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await db
    .select({
      avg: sql<number>`AVG(${usageLogs.latencyMs})`.as('avg'),
      min: sql<number>`MIN(${usageLogs.latencyMs})`.as('min'),
      max: sql<number>`MAX(${usageLogs.latencyMs})`.as('max'),
      p50: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${usageLogs.latencyMs})`.as('p50'),
      p95: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${usageLogs.latencyMs})`.as('p95'),
      p99: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${usageLogs.latencyMs})`.as('p99'),
    })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.apiKeyId, apiKeyId),
        gte(usageLogs.timestamp, startDate),
        sql`${usageLogs.latencyMs} IS NOT NULL`
      )
    );

  return {
    averageLatencyMs: Math.round(Number(stats[0]?.avg || 0)),
    medianLatencyMs: Math.round(Number(stats[0]?.p50 || 0)),
    p95LatencyMs: Math.round(Number(stats[0]?.p95 || 0)),
    p99LatencyMs: Math.round(Number(stats[0]?.p99 || 0)),
    minLatencyMs: Math.round(Number(stats[0]?.min || 0)),
    maxLatencyMs: Math.round(Number(stats[0]?.max || 0)),
  };
}
