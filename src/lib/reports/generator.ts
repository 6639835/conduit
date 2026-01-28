import { db } from '../db';
import { usageLogs, apiKeys } from '../db/schema';
import { and, avg, gte, lt, sql } from 'drizzle-orm';
import {
  type ReportData,
  type ReportFrequency,
  reportTemplates,
} from './templates';
import { sendEmail } from '../notifications/email';

/**
 * Get the date range for a given frequency
 */
function getDateRange(frequency: ReportFrequency): { start: Date; end: Date; label: string; previousStart: Date; previousEnd: Date } {
  const now = new Date();
  let end = new Date(now);
  let start = new Date(now);
  let previousStart = new Date(now);
  let previousEnd = new Date(now);
  let label = '';

  switch (frequency) {
    case 'daily':
      // Yesterday
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);

      // Day before yesterday (for comparison)
      previousStart.setDate(previousStart.getDate() - 2);
      previousStart.setHours(0, 0, 0, 0);
      previousEnd.setDate(previousEnd.getDate() - 2);
      previousEnd.setHours(23, 59, 59, 999);

      label = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      break;

    case 'weekly':
      // Last 7 days
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);

      // Previous 7 days (for comparison)
      previousStart.setDate(previousStart.getDate() - 14);
      previousStart.setHours(0, 0, 0, 0);
      previousEnd.setDate(previousEnd.getDate() - 7);
      previousEnd.setHours(23, 59, 59, 999);

      label = `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      break;

    case 'monthly':
      // Last month
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      // Month before last (for comparison)
      previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);

      label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      break;
  }

  return { start, end, label, previousStart, previousEnd };
}

/**
 * Fetch usage data for the report
 */
async function fetchReportData(start: Date, end: Date): Promise<Omit<ReportData, 'period' | 'trends' | 'alerts'>> {
  const timeRange = and(gte(usageLogs.timestamp, start), lt(usageLogs.timestamp, end));

  // Get overall statistics
  const overallStats = await db
    .select({
      totalRequests: sql<number>`count(*)`,
      successfulRequests: sql<number>`count(*) filter (where ${usageLogs.statusCode} < 400)`,
      failedRequests: sql<number>`count(*) filter (where ${usageLogs.statusCode} >= 400)`,
      totalCost: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageLogs.tokensInput} + ${usageLogs.tokensOutput}), 0)`,
    })
    .from(usageLogs)
    .where(timeRange);

  // Get active API keys count
  const activeKeysCount = await db
    .select({
      count: sql<number>`count(distinct ${usageLogs.apiKeyId})`,
    })
    .from(usageLogs)
    .where(timeRange);

  // Get top models
  const topModelsData = await db
    .select({
      model: usageLogs.model,
      requests: sql<number>`count(*)`,
      cost: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
    })
    .from(usageLogs)
    .where(timeRange)
    .groupBy(usageLogs.model)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  // Get top API keys
  const topKeysData = await db
    .select({
      apiKeyId: usageLogs.apiKeyId,
      requests: sql<number>`count(*)`,
      cost: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
    })
    .from(usageLogs)
    .where(timeRange)
    .groupBy(usageLogs.apiKeyId)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  // Enrich top keys with key details
  const topApiKeys = [];
  for (const keyData of topKeysData) {
    const [key] = await db
      .select({
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
      })
      .from(apiKeys)
      .where(sql`${apiKeys.id} = ${keyData.apiKeyId}`)
      .limit(1);

    if (key) {
      topApiKeys.push({
        keyPrefix: key.keyPrefix,
        name: key.name,
        requests: Number(keyData.requests),
        cost: Number(keyData.cost),
      });
    }
  }

  const stats = overallStats[0];
  const activeKeys = activeKeysCount[0];

  return {
    summary: {
      totalRequests: Number(stats.totalRequests),
      successfulRequests: Number(stats.successfulRequests),
      failedRequests: Number(stats.failedRequests),
      totalCost: Number(stats.totalCost),
      totalTokens: Number(stats.totalTokens),
      activeApiKeys: Number(activeKeys.count),
    },
    topModels: topModelsData.map(m => ({
      model: m.model,
      requests: Number(m.requests),
      cost: Number(m.cost),
    })),
    topApiKeys,
  };
}

async function fetchAvgResponseTimeMs(start: Date, end: Date): Promise<number> {
  const [result] = await db
    .select({
      avgLatencyMs: avg(usageLogs.latencyMs),
    })
    .from(usageLogs)
    .where(and(gte(usageLogs.timestamp, start), lt(usageLogs.timestamp, end)));

  const raw = result?.avgLatencyMs;
  const avgLatencyMs = typeof raw === 'string' ? Number(raw) : (raw ?? 0);
  return Number.isFinite(avgLatencyMs) ? Math.round(avgLatencyMs) : 0;
}

/**
 * Calculate trends by comparing current period with previous period
 */
async function calculateTrends(
  currentData: Omit<ReportData, 'period' | 'trends' | 'alerts'>,
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): Promise<ReportData['trends']> {
  const previousData = await fetchReportData(previousStart, previousEnd);
  const currentAvgResponseTime = await fetchAvgResponseTimeMs(currentStart, currentEnd);

  const requestsChange =
    previousData.summary.totalRequests > 0
      ? ((currentData.summary.totalRequests - previousData.summary.totalRequests) /
          previousData.summary.totalRequests) *
        100
      : 0;

  const costChange =
    previousData.summary.totalCost > 0
      ? ((currentData.summary.totalCost - previousData.summary.totalCost) /
          previousData.summary.totalCost) *
        100
      : 0;

  const errorRate =
    currentData.summary.totalRequests > 0
      ? (currentData.summary.failedRequests / currentData.summary.totalRequests) * 100
      : 0;

  return {
    requestsChange,
    costChange,
    avgResponseTime: currentAvgResponseTime,
    errorRate,
  };
}

/**
 * Generate alerts based on report data
 */
function generateAlerts(data: Omit<ReportData, 'alerts'>, frequency: ReportFrequency): ReportData['alerts'] {
  const alerts: ReportData['alerts'] = [];

  // High error rate alert
  if (data.trends.errorRate > 5) {
    alerts.push({
      type: 'error',
      message: `High error rate detected: ${data.trends.errorRate.toFixed(2)}%`,
    });
  } else if (data.trends.errorRate > 2) {
    alerts.push({
      type: 'warning',
      message: `Elevated error rate: ${data.trends.errorRate.toFixed(2)}%`,
    });
  }

  // Cost spike alert
  if (data.trends.costChange > 50) {
    alerts.push({
      type: 'warning',
      message: `Significant cost increase: ${data.trends.costChange.toFixed(1)}% compared to previous ${frequency}`,
    });
  }

  // Request spike alert
  if (data.trends.requestsChange > 100) {
    alerts.push({
      type: 'info',
      message: `High request volume: ${data.trends.requestsChange.toFixed(1)}% increase compared to previous ${frequency}`,
    });
  }

  // Low activity alert
  if (data.summary.totalRequests < 10 && frequency === 'daily') {
    alerts.push({
      type: 'info',
      message: 'Very low activity detected. Check if your API keys are being used.',
    });
  }

  return alerts;
}

/**
 * Generate a complete report
 */
export async function generateReport(frequency: ReportFrequency): Promise<ReportData> {
  const { start, end, label, previousStart, previousEnd } = getDateRange(frequency);

  const currentData = await fetchReportData(start, end);
  const trends = await calculateTrends(currentData, start, end, previousStart, previousEnd);
  const alerts = generateAlerts({ ...currentData, period: { start, end, label }, trends }, frequency);

  return {
    period: { start, end, label },
    ...currentData,
    trends,
    alerts,
  };
}

/**
 * Send report via email
 */
export async function sendReportEmail(
  to: string,
  data: ReportData,
  frequency: ReportFrequency
): Promise<{ success: boolean; error?: string }> {
  const template = reportTemplates[frequency];

  const subject = template.generateSubject(data);
  const html = template.generateEmailBody(data);
  const text = `Conduit ${template.name} (${data.period.label})`;

  const ok = await sendEmail({ to, subject, html, text });
  if (!ok) return { success: false, error: 'Failed to send email (provider not configured or send failed)' };
  return { success: true };
}

/**
 * Send report to Slack
 */
export async function sendReportSlack(
  webhookUrl: string,
  data: ReportData,
  frequency: ReportFrequency
): Promise<{ success: boolean; error?: string }> {
  const template = reportTemplates[frequency];
  const message = template.generateSlackMessage(data);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API returned ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send report to Discord
 */
export async function sendReportDiscord(
  webhookUrl: string,
  data: ReportData,
  frequency: ReportFrequency
): Promise<{ success: boolean; error?: string }> {
  const template = reportTemplates[frequency];
  const message = template.generateDiscordMessage(data);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Discord API returned ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
