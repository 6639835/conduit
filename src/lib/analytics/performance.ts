/**
 * Performance Metrics & SLA Tracking System
 *
 * Calculates percentiles (p50, p95, p99), uptime, and SLA compliance
 */

import { db } from '@/lib/db';
import { usageLogs } from '@/lib/db/schema';
import { gte, lte, and, eq } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface PerformanceMetrics {
  period: {
    start: Date;
    end: Date;
    label: string;
  };
  latency: {
    p50: number; // Median
    p95: number; // 95th percentile
    p99: number; // 99th percentile
    average: number;
    min: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
    totalRequests: number;
  };
  uptime: {
    percentage: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
  };
  sla: {
    target: number; // e.g., 99.9%
    actual: number;
    met: boolean;
    violations: number;
  };
}

export interface SLAConfig {
  target: number; // Target uptime percentage (e.g., 99.9)
  latencyThreshold: number; // Max acceptable latency in ms (e.g., 1000)
}

// ============================================================================
// Percentile Calculation
// ============================================================================

/**
 * Calculate percentile from sorted array
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Calculate latency percentiles from response times
 */
export function calculateLatencyPercentiles(latencyMss: number[]): {
  p50: number;
  p95: number;
  p99: number;
  average: number;
  min: number;
  max: number;
} {
  if (latencyMss.length === 0) {
    return { p50: 0, p95: 0, p99: 0, average: 0, min: 0, max: 0 };
  }

  const sorted = [...latencyMss].sort((a, b) => a - b);

  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const average = sum / sorted.length;

  return {
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    average,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// ============================================================================
// Performance Metrics Calculation
// ============================================================================

/**
 * Calculate performance metrics for a given time period
 */
export async function calculatePerformanceMetrics(
  startDate: Date,
  endDate: Date,
  apiKeyId?: string,
  slaConfig: SLAConfig = { target: 99.9, latencyThreshold: 1000 }
): Promise<PerformanceMetrics> {
  // Build query conditions
  const conditions = [gte(usageLogs.timestamp, startDate), lte(usageLogs.timestamp, endDate)];

  if (apiKeyId) {
    conditions.push(eq(usageLogs.apiKeyId, apiKeyId));
  }

  // Fetch usageLogs
  const logRecords = await db
    .select({
      timestamp: usageLogs.timestamp,
      statusCode: usageLogs.statusCode,
      latencyMs: usageLogs.latencyMs,
      errorMessage: usageLogs.errorMessage,
    })
    .from(usageLogs)
    .where(and(...conditions))
    .orderBy(usageLogs.timestamp);

  // Calculate metrics
  const totalRequests = logRecords.length;
  const successfulRequests = logRecords.filter(
    log => log.statusCode >= 200 && log.statusCode < 400
  ).length;
  const failedRequests = totalRequests - successfulRequests;

  const latencyMss = logRecords
    .filter(log => log.latencyMs !== null)
    .map(log => log.latencyMs as number);

  const latency = calculateLatencyPercentiles(latencyMss);

  // Calculate uptime
  const uptimePercentage = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;

  // Calculate throughput
  const durationSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
  const requestsPerSecond = totalRequests / durationSeconds;
  const requestsPerMinute = requestsPerSecond * 60;
  const requestsPerHour = requestsPerMinute * 60;

  // Calculate SLA compliance
  const slaViolations = logRecords.filter(
    log =>
      log.statusCode >= 500 || (log.latencyMs && log.latencyMs > slaConfig.latencyThreshold)
  ).length;

  const slaActual = totalRequests > 0 ? ((totalRequests - slaViolations) / totalRequests) * 100 : 100;
  const slaMet = slaActual >= slaConfig.target;

  return {
    period: {
      start: startDate,
      end: endDate,
      label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    },
    latency,
    throughput: {
      requestsPerSecond,
      requestsPerMinute,
      requestsPerHour,
      totalRequests,
    },
    uptime: {
      percentage: uptimePercentage,
      totalRequests,
      successfulRequests,
      failedRequests,
    },
    sla: {
      target: slaConfig.target,
      actual: slaActual,
      met: slaMet,
      violations: slaViolations,
    },
  };
}

// ============================================================================
// Time Period Helpers
// ============================================================================

export function getDateRange(
  period: 'hour' | 'day' | 'week' | 'month'
): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = now;
  let start: Date;
  let label: string;

  switch (period) {
    case 'hour':
      start = new Date(now.getTime() - 60 * 60 * 1000);
      label = 'Last Hour';
      break;
    case 'day':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      label = 'Last 24 Hours';
      break;
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      label = 'Last 7 Days';
      break;
    case 'month':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      label = 'Last 30 Days';
      break;
    default:
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      label = 'Last 24 Hours';
  }

  return { start, end, label };
}

// ============================================================================
// SLA Report Generation
// ============================================================================

export interface SLAReport {
  period: {
    start: Date;
    end: Date;
    label: string;
  };
  overall: {
    uptimePercentage: number;
    slaTarget: number;
    slaMet: boolean;
    totalRequests: number;
    violations: number;
  };
  byDay: Array<{
    date: string;
    uptimePercentage: number;
    totalRequests: number;
    violations: number;
  }>;
  topErrors: Array<{
    statusCode: number;
    count: number;
    percentage: number;
  }>;
  latencyBreakdown: {
    under100ms: number;
    under500ms: number;
    under1000ms: number;
    over1000ms: number;
  };
}

/**
 * Generate comprehensive SLA report
 */
export async function generateSLAReport(
  startDate: Date,
  endDate: Date,
  apiKeyId?: string,
  slaTarget: number = 99.9
): Promise<SLAReport> {
  const conditions = [gte(usageLogs.timestamp, startDate), lte(usageLogs.timestamp, endDate)];

  if (apiKeyId) {
    conditions.push(eq(usageLogs.apiKeyId, apiKeyId));
  }

  // Fetch all usageLogs
  const logRecords = await db
    .select()
    .from(usageLogs)
    .where(and(...conditions))
    .orderBy(usageLogs.timestamp);

  // Calculate overall metrics
  const totalRequests = logRecords.length;
  const violations = logRecords.filter(
    log => log.statusCode >= 500 || (log.latencyMs && log.latencyMs > 1000)
  ).length;
  const uptimePercentage = totalRequests > 0 ? ((totalRequests - violations) / totalRequests) * 100 : 100;

  // Group by day
  const byDay: Map<string, { total: number; violations: number }> = new Map();
  logRecords.forEach(log => {
    const date = log.timestamp.toISOString().split('T')[0];
    if (!byDay.has(date)) {
      byDay.set(date, { total: 0, violations: 0 });
    }
    const dayStats = byDay.get(date)!;
    dayStats.total++;
    if (log.statusCode >= 500 || (log.latencyMs && log.latencyMs > 1000)) {
      dayStats.violations++;
    }
  });

  const byDayArray = Array.from(byDay.entries())
    .map(([date, stats]) => ({
      date,
      uptimePercentage: stats.total > 0 ? ((stats.total - stats.violations) / stats.total) * 100 : 100,
      totalRequests: stats.total,
      violations: stats.violations,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Count errors by status code
  const errorCounts: Map<number, number> = new Map();
  logRecords
    .filter(log => log.statusCode >= 400)
    .forEach(log => {
      errorCounts.set(log.statusCode, (errorCounts.get(log.statusCode) || 0) + 1);
    });

  const topErrors = Array.from(errorCounts.entries())
    .map(([statusCode, count]) => ({
      statusCode,
      count,
      percentage: (count / totalRequests) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Latency breakdown
  let under100ms = 0;
  let under500ms = 0;
  let under1000ms = 0;
  let over1000ms = 0;

  logRecords.forEach(log => {
    if (log.latencyMs === null) return;
    if (log.latencyMs < 100) under100ms++;
    else if (log.latencyMs < 500) under500ms++;
    else if (log.latencyMs < 1000) under1000ms++;
    else over1000ms++;
  });

  return {
    period: {
      start: startDate,
      end: endDate,
      label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    },
    overall: {
      uptimePercentage,
      slaTarget,
      slaMet: uptimePercentage >= slaTarget,
      totalRequests,
      violations,
    },
    byDay: byDayArray,
    topErrors,
    latencyBreakdown: {
      under100ms,
      under500ms,
      under1000ms,
      over1000ms,
    },
  };
}
