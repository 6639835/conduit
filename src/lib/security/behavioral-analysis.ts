/**
 * Behavioral Analysis for API Keys
 * Detect anomalous usage patterns and potential security threats
 */

import { db } from '@/lib/db';
import { requestLogs, apiKeys } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { kv } from '@vercel/kv';

export interface BehavioralPattern {
  apiKeyId: string;
  keyPrefix: string;
  metrics: {
    avgRequestsPerHour: number;
    avgRequestsPerDay: number;
    peakHour: number;
    commonModels: string[];
    commonIpAddresses: string[];
    avgCostPerRequest: number;
    errorRate: number;
  };
  anomalies: Anomaly[];
  riskScore: number; // 0-100
  lastUpdated: Date;
}

export interface Anomaly {
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  metadata?: Record<string, unknown>;
}

export enum AnomalyType {
  UNUSUAL_VOLUME = 'unusual_volume',
  UNUSUAL_TIMING = 'unusual_timing',
  UNUSUAL_LOCATION = 'unusual_location',
  UNUSUAL_MODEL = 'unusual_model',
  HIGH_ERROR_RATE = 'high_error_rate',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  RAPID_REQUESTS = 'rapid_requests',
  COST_SPIKE = 'cost_spike',
}

/**
 * Analyze behavioral patterns for an API key
 */
export async function analyzeBehavior(
  apiKeyId: string,
  days: number = 30
): Promise<BehavioralPattern> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get API key info
  const [key] = await db
    .select({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix })
    .from(apiKeys)
    .where(eq(apiKeys.id, apiKeyId))
    .limit(1);

  if (!key) {
    throw new Error('API key not found');
  }

  // Get request statistics
  const requests = await db
    .select({
      createdAt: requestLogs.createdAt,
      model: requestLogs.model,
      statusCode: requestLogs.statusCode,
      cost: requestLogs.cost,
      metadata: requestLogs.metadata,
    })
    .from(requestLogs)
    .where(and(eq(requestLogs.apiKeyId, apiKeyId), gte(requestLogs.createdAt, since)));

  // Calculate metrics
  const totalRequests = requests.length;
  const totalDays = days;
  const totalHours = days * 24;

  const avgRequestsPerHour = totalRequests / totalHours;
  const avgRequestsPerDay = totalRequests / totalDays;

  // Peak hour analysis
  const hourCounts = new Map<number, number>();
  for (const req of requests) {
    const hour = new Date(req.createdAt).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  const peakHour = Array.from(hourCounts.entries()).reduce(
    (max, [hour, count]) => (count > max.count ? { hour, count } : max),
    { hour: 0, count: 0 }
  ).hour;

  // Common models
  const modelCounts = new Map<string, number>();
  for (const req of requests) {
    if (req.model) {
      modelCounts.set(req.model, (modelCounts.get(req.model) || 0) + 1);
    }
  }

  const commonModels = Array.from(modelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([model]) => model);

  // IP addresses from metadata
  const ipCounts = new Map<string, number>();
  for (const req of requests) {
    const metadata = req.metadata as Record<string, unknown> | null;
    const ip = typeof metadata?.ip === 'string'
      ? metadata.ip
      : typeof metadata?.ipAddress === 'string'
        ? metadata.ipAddress
        : undefined;
    if (ip) {
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    }
  }

  const commonIpAddresses = Array.from(ipCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ip]) => ip);

  // Cost analysis
  const totalCost = requests.reduce(
    (sum, req) => sum + parseFloat(req.cost?.toString() || '0'),
    0
  );
  const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

  // Error rate
  const errorCount = requests.filter(req => (req.statusCode || 0) >= 400).length;
  const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

  // Detect anomalies
  const anomalies: Anomaly[] = [];

  // Volume anomaly (more than 5x average)
  const recentHourRequests = requests.filter(
    r => new Date(r.createdAt).getTime() > Date.now() - 60 * 60 * 1000
  ).length;

  if (recentHourRequests > avgRequestsPerHour * 5) {
    anomalies.push({
      type: AnomalyType.UNUSUAL_VOLUME,
      severity: 'high',
      description: `Unusual request volume: ${recentHourRequests} requests in the last hour (5x normal)`,
      detectedAt: new Date(),
      metadata: { recentHourRequests, avgRequestsPerHour },
    });
  }

  // Error rate anomaly
  if (errorRate > 0.2) {
    // More than 20% error rate
    anomalies.push({
      type: AnomalyType.HIGH_ERROR_RATE,
      severity: errorRate > 0.5 ? 'critical' : 'high',
      description: `High error rate: ${(errorRate * 100).toFixed(1)}% of requests failing`,
      detectedAt: new Date(),
      metadata: { errorRate, errorCount, totalRequests },
    });
  }

  // Cost spike (request cost 10x higher than average)
  const recentCosts = requests
    .filter(r => new Date(r.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000)
    .map(r => parseFloat(r.cost?.toString() || '0'));

  const recentAvgCost =
    recentCosts.length > 0
      ? recentCosts.reduce((sum, cost) => sum + cost, 0) / recentCosts.length
      : 0;

  if (recentAvgCost > avgCostPerRequest * 10 && avgCostPerRequest > 0) {
    anomalies.push({
      type: AnomalyType.COST_SPIKE,
      severity: 'medium',
      description: `Unusual cost spike: ${recentAvgCost.toFixed(4)} per request (10x normal)`,
      detectedAt: new Date(),
      metadata: { recentAvgCost, avgCostPerRequest },
    });
  }

  // Rapid requests (more than 100 requests per minute)
  const oneMinuteAgo = Date.now() - 60 * 1000;
  const lastMinuteRequests = requests.filter(
    r => new Date(r.createdAt).getTime() > oneMinuteAgo
  ).length;

  if (lastMinuteRequests > 100) {
    anomalies.push({
      type: AnomalyType.RAPID_REQUESTS,
      severity: 'medium',
      description: `Rapid request burst: ${lastMinuteRequests} requests in the last minute`,
      detectedAt: new Date(),
      metadata: { lastMinuteRequests },
    });
  }

  // Calculate risk score
  let riskScore = 0;
  for (const anomaly of anomalies) {
    switch (anomaly.severity) {
      case 'critical':
        riskScore += 40;
        break;
      case 'high':
        riskScore += 25;
        break;
      case 'medium':
        riskScore += 15;
        break;
      case 'low':
        riskScore += 5;
        break;
    }
  }
  riskScore = Math.min(100, riskScore);

  const pattern: BehavioralPattern = {
    apiKeyId: key.id,
    keyPrefix: key.keyPrefix,
    metrics: {
      avgRequestsPerHour,
      avgRequestsPerDay,
      peakHour,
      commonModels,
      commonIpAddresses,
      avgCostPerRequest,
      errorRate,
    },
    anomalies,
    riskScore,
    lastUpdated: new Date(),
  };

  // Cache the pattern
  await kv.set(`behavior:${apiKeyId}`, JSON.stringify(pattern), { ex: 3600 });

  return pattern;
}

/**
 * Get cached behavioral pattern or analyze
 */
export async function getBehavioralPattern(apiKeyId: string): Promise<BehavioralPattern | null> {
  const cached = await kv.get<string>(`behavior:${apiKeyId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    return await analyzeBehavior(apiKeyId);
  } catch (error) {
    console.error('Error analyzing behavior:', error);
    return null;
  }
}

/**
 * Detect PII in request content
 */
export interface PIIDetectionResult {
  hasPII: boolean;
  types: PIIType[];
  redactedContent: string;
  originalLength: number;
  redactedLength: number;
}

export enum PIIType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  IP_ADDRESS = 'ip_address',
  API_KEY = 'api_key',
  PASSWORD = 'password',
}

export function detectPII(content: string): PIIDetectionResult {
  const types: PIIType[] = [];
  let redacted = content;

  // Email detection
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  if (emailPattern.test(content)) {
    types.push(PIIType.EMAIL);
    redacted = redacted.replace(emailPattern, '[EMAIL_REDACTED]');
  }

  // Phone number detection
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  if (phonePattern.test(content)) {
    types.push(PIIType.PHONE);
    redacted = redacted.replace(phonePattern, '[PHONE_REDACTED]');
  }

  // SSN detection
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
  if (ssnPattern.test(content)) {
    types.push(PIIType.SSN);
    redacted = redacted.replace(ssnPattern, '[SSN_REDACTED]');
  }

  // Credit card detection
  const ccPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
  if (ccPattern.test(content)) {
    types.push(PIIType.CREDIT_CARD);
    redacted = redacted.replace(ccPattern, '[CC_REDACTED]');
  }

  // IP address detection
  const ipPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
  if (ipPattern.test(content)) {
    types.push(PIIType.IP_ADDRESS);
    redacted = redacted.replace(ipPattern, '[IP_REDACTED]');
  }

  // API key detection (common patterns)
  const apiKeyPattern = /\b(sk-|pk-|api_key_|token_)[a-zA-Z0-9]{20,}\b/gi;
  if (apiKeyPattern.test(content)) {
    types.push(PIIType.API_KEY);
    redacted = redacted.replace(apiKeyPattern, '[API_KEY_REDACTED]');
  }

  // Password detection (common patterns in prompts)
  const passwordPattern = /password[:\s]+["']?[^\s"']{8,}["']?/gi;
  if (passwordPattern.test(content)) {
    types.push(PIIType.PASSWORD);
    redacted = redacted.replace(passwordPattern, 'password: [REDACTED]');
  }

  return {
    hasPII: types.length > 0,
    types,
    redactedContent: redacted,
    originalLength: content.length,
    redactedLength: redacted.length,
  };
}

/**
 * Automated key rotation
 */
export interface KeyRotationSchedule {
  apiKeyId: string;
  rotationIntervalDays: number;
  lastRotated: Date;
  nextRotation: Date;
  autoRotate: boolean;
}

export async function scheduleKeyRotation(
  apiKeyId: string,
  intervalDays: number
): Promise<KeyRotationSchedule> {
  const schedule: KeyRotationSchedule = {
    apiKeyId,
    rotationIntervalDays: intervalDays,
    lastRotated: new Date(),
    nextRotation: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
    autoRotate: true,
  };

  await kv.set(`rotation:${apiKeyId}`, JSON.stringify(schedule), {
    ex: intervalDays * 24 * 60 * 60,
  });

  return schedule;
}

/**
 * Check if key needs rotation
 */
export async function checkKeyRotation(apiKeyId: string): Promise<{
  needsRotation: boolean;
  schedule: KeyRotationSchedule | null;
}> {
  const scheduleData = await kv.get<string>(`rotation:${apiKeyId}`);

  if (!scheduleData) {
    return { needsRotation: false, schedule: null };
  }

  const schedule: KeyRotationSchedule = JSON.parse(scheduleData);
  const needsRotation = new Date(schedule.nextRotation).getTime() <= Date.now();

  return { needsRotation, schedule };
}
