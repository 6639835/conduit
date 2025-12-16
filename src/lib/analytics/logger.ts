/**
 * Usage logging system
 * Logs all API requests to the database for analytics
 */

import { db } from '@/lib/db';
import { usageLogs } from '@/lib/db/schema';
import { calculateCost } from './cost-calculator';

export interface LogUsageParams {
  apiKeyId: string;
  method: string;
  path: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  statusCode: number;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
}

/**
 * Log usage to database (async, non-blocking)
 * Errors are logged but don't fail the request
 */
export async function logUsage(params: LogUsageParams): Promise<void> {
  try {
    // Calculate cost
    const costUsd = calculateCost(params.model, params.tokensInput, params.tokensOutput);

    // Insert into database
    await db.insert(usageLogs).values({
      apiKeyId: params.apiKeyId,
      method: params.method,
      path: params.path,
      model: params.model,
      tokensInput: params.tokensInput,
      tokensOutput: params.tokensOutput,
      costUsd,
      latencyMs: params.latencyMs,
      statusCode: params.statusCode,
      errorMessage: params.errorMessage || null,
      userAgent: params.userAgent || null,
      ipAddress: params.ipAddress || null,
      country: params.country || null,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error logging usage:', error);
    // Don't throw - logging failures shouldn't affect user requests
  }
}

/**
 * Log usage asynchronously (fire-and-forget)
 * Use this in API routes to avoid blocking responses
 */
export function logUsageAsync(params: LogUsageParams): void {
  // Fire and forget
  logUsage(params).catch((error) => {
    console.error('Async logging error:', error);
  });
}

/**
 * Extract request metadata from headers
 */
export function extractRequestMetadata(headers: Headers): {
  userAgent?: string;
  ipAddress?: string;
  country?: string;
} {
  return {
    userAgent: headers.get('user-agent') || undefined,
    ipAddress: headers.get('x-forwarded-for')?.split(',')[0] || headers.get('x-real-ip') || undefined,
    country: headers.get('cf-ipcountry') || undefined, // Cloudflare country header
  };
}
