import { db } from '../db';
import { usageLogs } from '../db/schema';
import { eq, gte, sql } from 'drizzle-orm';

export type AnomalyType =
  | 'usage_spike'
  | 'cost_spike'
  | 'error_rate_spike'
  | 'latency_spike'
  | 'usage_drop'
  | 'unusual_pattern';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Anomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number; // Standard deviations from mean
  threshold: number;
  timestamp: Date;
  apiKeyId?: string;
  message: string;
  details: {
    zScore?: number;
    movingAverage?: number;
    standardDeviation?: number;
    percentageChange?: number;
  };
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

/**
 * Calculate mean of an array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const variance = mean(squareDiffs);
  return Math.sqrt(variance);
}

/**
 * Calculate Z-score for anomaly detection
 * Z-score measures how many standard deviations an element is from the mean
 */
export function calculateZScore(value: number, values: number[]): number {
  const avg = mean(values);
  const stdDev = standardDeviation(values);

  if (stdDev === 0) return 0;
  return (value - avg) / stdDev;
}

/**
 * Detect anomalies using Z-score method
 * Typically, |Z| > 3 indicates an anomaly
 */
export function detectZScoreAnomalies(
  timeSeries: TimeSeriesPoint[],
  threshold: number = 3
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (timeSeries.length < 10) {
    // Need at least 10 data points for reliable detection
    return anomalies;
  }

  const values = timeSeries.map(p => p.value);
  const avg = mean(values);
  const stdDev = standardDeviation(values);

  // Check the most recent point
  const latest = timeSeries[timeSeries.length - 1];
  const zScore = calculateZScore(latest.value, values.slice(0, -1)); // Exclude latest from calculation

  if (Math.abs(zScore) > threshold) {
    const isSpike = zScore > 0;

    anomalies.push({
      type: isSpike ? 'usage_spike' : 'usage_drop',
      severity: Math.abs(zScore) > 5 ? 'critical' : Math.abs(zScore) > 4 ? 'high' : 'medium',
      metric: 'requests',
      currentValue: latest.value,
      expectedValue: avg,
      deviation: Math.abs(zScore),
      threshold,
      timestamp: latest.timestamp,
      message: `${isSpike ? 'Spike' : 'Drop'} detected: ${latest.value.toFixed(0)} vs expected ${avg.toFixed(0)}`,
      details: {
        zScore,
        standardDeviation: stdDev,
        percentageChange: ((latest.value - avg) / avg) * 100,
      },
    });
  }

  return anomalies;
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(values: number[], windowSize: number = 7): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    result.push(mean(window));
  }

  return result;
}

/**
 * Detect anomalies using moving average method
 */
export function detectMovingAverageAnomalies(
  timeSeries: TimeSeriesPoint[],
  windowSize: number = 7,
  sensitivityFactor: number = 1.5
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (timeSeries.length < windowSize * 2) {
    return anomalies;
  }

  const values = timeSeries.map(p => p.value);
  const movingAverages = calculateMovingAverage(values, windowSize);

  // Check the most recent point
  const latest = timeSeries[timeSeries.length - 1];
  const latestMA = movingAverages[movingAverages.length - 1];

  const upperBound = latestMA * (1 + sensitivityFactor);
  const lowerBound = latestMA * (1 - sensitivityFactor);

  if (latest.value > upperBound || latest.value < lowerBound) {
    const isSpike = latest.value > upperBound;
    const percentageChange = ((latest.value - latestMA) / latestMA) * 100;

    anomalies.push({
      type: isSpike ? 'usage_spike' : 'usage_drop',
      severity: Math.abs(percentageChange) > 200 ? 'critical' : Math.abs(percentageChange) > 100 ? 'high' : 'medium',
      metric: 'requests',
      currentValue: latest.value,
      expectedValue: latestMA,
      deviation: Math.abs(latest.value - latestMA) / latestMA,
      threshold: sensitivityFactor,
      timestamp: latest.timestamp,
      message: `${isSpike ? 'Spike' : 'Drop'} detected: ${latest.value.toFixed(0)} vs MA ${latestMA.toFixed(0)}`,
      details: {
        movingAverage: latestMA,
        percentageChange,
      },
    });
  }

  return anomalies;
}

/**
 * Calculate exponential moving average (EMA)
 */
export function calculateEMA(values: number[], alpha: number = 0.3): number[] {
  const result: number[] = [];

  if (values.length === 0) return result;

  result.push(values[0]); // First value is same as input

  for (let i = 1; i < values.length; i++) {
    const ema = alpha * values[i] + (1 - alpha) * result[i - 1];
    result.push(ema);
  }

  return result;
}

/**
 * Detect anomalies using exponential smoothing
 */
export function detectExponentialSmoothingAnomalies(
  timeSeries: TimeSeriesPoint[],
  alpha: number = 0.3,
  threshold: number = 2
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (timeSeries.length < 10) {
    return anomalies;
  }

  const values = timeSeries.map(p => p.value);
  const ema = calculateEMA(values, alpha);

  // Calculate residuals (actual - predicted)
  const residuals = values.map((v, i) => v - ema[i]);
  const residualStdDev = standardDeviation(residuals);

  // Check the most recent point
  const latest = timeSeries[timeSeries.length - 1];
  const latestEMA = ema[ema.length - 1];
  const residual = latest.value - latestEMA;

  if (Math.abs(residual) > threshold * residualStdDev) {
    const isSpike = residual > 0;

    anomalies.push({
      type: isSpike ? 'usage_spike' : 'usage_drop',
      severity: Math.abs(residual) > 4 * residualStdDev ? 'critical' : Math.abs(residual) > 3 * residualStdDev ? 'high' : 'medium',
      metric: 'requests',
      currentValue: latest.value,
      expectedValue: latestEMA,
      deviation: Math.abs(residual) / residualStdDev,
      threshold,
      timestamp: latest.timestamp,
      message: `${isSpike ? 'Spike' : 'Drop'} detected using EMA: ${latest.value.toFixed(0)} vs expected ${latestEMA.toFixed(0)}`,
      details: {
        standardDeviation: residualStdDev,
        percentageChange: ((latest.value - latestEMA) / latestEMA) * 100,
      },
    });
  }

  return anomalies;
}

/**
 * Fetch hourly request data for the last N days
 */
async function fetchHourlyRequestData(
  apiKeyId: string | null,
  days: number = 7
): Promise<TimeSeriesPoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const conditions = [gte(usageLogs.timestamp, startDate)];
  if (apiKeyId) {
    conditions.push(eq(usageLogs.apiKeyId, apiKeyId));
  }

  const hourlyData = await db
    .select({
      hour: sql<string>`date_trunc('hour', ${usageLogs.timestamp})`,
      requests: sql<number>`count(*)`,
    })
    .from(usageLogs)
    .where(sql`${sql.join(conditions, sql` AND `)}`)
    .groupBy(sql`date_trunc('hour', ${usageLogs.timestamp})`)
    .orderBy(sql`date_trunc('hour', ${usageLogs.timestamp})`);

  return hourlyData.map(d => ({
    timestamp: new Date(d.hour),
    value: Number(d.requests),
  }));
}

/**
 * Fetch hourly cost data
 */
async function fetchHourlyCostData(
  apiKeyId: string | null,
  days: number = 7
): Promise<TimeSeriesPoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const conditions = [gte(usageLogs.timestamp, startDate)];
  if (apiKeyId) {
    conditions.push(eq(usageLogs.apiKeyId, apiKeyId));
  }

  const hourlyData = await db
    .select({
      hour: sql<string>`date_trunc('hour', ${usageLogs.timestamp})`,
      cost: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
    })
    .from(usageLogs)
    .where(sql`${sql.join(conditions, sql` AND `)}`)
    .groupBy(sql`date_trunc('hour', ${usageLogs.timestamp})`)
    .orderBy(sql`date_trunc('hour', ${usageLogs.timestamp})`);

  return hourlyData.map(d => ({
    timestamp: new Date(d.hour),
    value: Number(d.cost) / 100, // Convert cents to dollars
  }));
}

/**
 * Fetch hourly error rate data
 */
async function fetchHourlyErrorRateData(
  apiKeyId: string | null,
  days: number = 7
): Promise<TimeSeriesPoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const conditions = [gte(usageLogs.timestamp, startDate)];
  if (apiKeyId) {
    conditions.push(eq(usageLogs.apiKeyId, apiKeyId));
  }

  const hourlyData = await db
    .select({
      hour: sql<string>`date_trunc('hour', ${usageLogs.timestamp})`,
      total: sql<number>`count(*)`,
      errors: sql<number>`count(*) filter (where ${usageLogs.statusCode} >= 400)`,
    })
    .from(usageLogs)
    .where(sql`${sql.join(conditions, sql` AND `)}`)
    .groupBy(sql`date_trunc('hour', ${usageLogs.timestamp})`)
    .orderBy(sql`date_trunc('hour', ${usageLogs.timestamp})`);

  return hourlyData.map(d => ({
    timestamp: new Date(d.hour),
    value: Number(d.total) > 0 ? (Number(d.errors) / Number(d.total)) * 100 : 0,
  }));
}

/**
 * Detect all anomalies for an API key (or global if null)
 */
export async function detectAnomalies(
  apiKeyId: string | null = null,
  lookbackDays: number = 7
): Promise<Anomaly[]> {
  const allAnomalies: Anomaly[] = [];

  // Fetch time series data
  const requestData = await fetchHourlyRequestData(apiKeyId, lookbackDays);
  const costData = await fetchHourlyCostData(apiKeyId, lookbackDays);
  const errorRateData = await fetchHourlyErrorRateData(apiKeyId, lookbackDays);

  // Detect usage anomalies using multiple methods
  if (requestData.length >= 10) {
    const zScoreAnomalies = detectZScoreAnomalies(requestData, 3);
    const maAnomalies = detectMovingAverageAnomalies(requestData, 7, 1.5);
    const emaAnomalies = detectExponentialSmoothingAnomalies(requestData, 0.3, 2);

    // Combine and deduplicate (take highest severity)
    const requestAnomalies = [...zScoreAnomalies, ...maAnomalies, ...emaAnomalies];
    if (requestAnomalies.length > 0) {
      // Sort by severity and take the most severe
      requestAnomalies.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
      const mostSevere = requestAnomalies[0];
      mostSevere.apiKeyId = apiKeyId || undefined;
      allAnomalies.push(mostSevere);
    }
  }

  // Detect cost anomalies
  if (costData.length >= 10) {
    const costAnomalies = detectZScoreAnomalies(costData, 3);
    costAnomalies.forEach(anomaly => {
      anomaly.type = 'cost_spike';
      anomaly.metric = 'cost';
      anomaly.apiKeyId = apiKeyId || undefined;
      anomaly.message = `Cost ${anomaly.type === 'cost_spike' ? 'spike' : 'drop'}: $${anomaly.currentValue.toFixed(2)} vs expected $${anomaly.expectedValue.toFixed(2)}`;
    });
    allAnomalies.push(...costAnomalies);
  }

  // Detect error rate anomalies
  if (errorRateData.length >= 10) {
    const errorAnomalies = detectZScoreAnomalies(errorRateData, 2.5); // Lower threshold for errors
    errorAnomalies.forEach(anomaly => {
      if (anomaly.currentValue > anomaly.expectedValue) { // Only care about increases
        anomaly.type = 'error_rate_spike';
        anomaly.metric = 'error_rate';
        anomaly.apiKeyId = apiKeyId || undefined;
        anomaly.message = `Error rate spike: ${anomaly.currentValue.toFixed(2)}% vs expected ${anomaly.expectedValue.toFixed(2)}%`;
      }
    });
    allAnomalies.push(...errorAnomalies.filter(a => a.type === 'error_rate_spike'));
  }

  return allAnomalies;
}

/**
 * Get anomaly severity color
 */
export function getAnomalySeverityColor(severity: AnomalySeverity): string {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'high':
      return 'orange';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'blue';
  }
}

/**
 * Get anomaly type label
 */
export function getAnomalyTypeLabel(type: AnomalyType): string {
  switch (type) {
    case 'usage_spike':
      return 'Usage Spike';
    case 'cost_spike':
      return 'Cost Spike';
    case 'error_rate_spike':
      return 'Error Rate Spike';
    case 'latency_spike':
      return 'Latency Spike';
    case 'usage_drop':
      return 'Usage Drop';
    case 'unusual_pattern':
      return 'Unusual Pattern';
  }
}
