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
    // Validate token counts (must be non-negative integers)
    const tokensInput = Math.max(0, Math.floor(params.tokensInput || 0));
    const tokensOutput = Math.max(0, Math.floor(params.tokensOutput || 0));

    if (isNaN(tokensInput) || isNaN(tokensOutput)) {
      console.error('Invalid token counts:', { tokensInput: params.tokensInput, tokensOutput: params.tokensOutput });
      return;
    }

    // Calculate cost
    const costUsd = calculateCost(params.model, tokensInput, tokensOutput);

    // Insert into database
    await db.insert(usageLogs).values({
      apiKeyId: params.apiKeyId,
      method: params.method,
      path: params.path,
      model: params.model,
      tokensInput,
      tokensOutput,
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
 * Note: In edge runtime, this may not complete if the function terminates early.
 * Consider using context.waitUntil() if available in your edge runtime.
 */
export function logUsageAsync(params: LogUsageParams): Promise<void> {
  // Return the promise so callers can optionally await or use waitUntil()
  return logUsage(params).catch((error) => {
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
  // Extract and trim IP address (x-forwarded-for can have spaces after commas)
  const forwardedFor = headers.get('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || headers.get('x-real-ip')?.trim() || undefined;

  return {
    userAgent: headers.get('user-agent') || undefined,
    ipAddress,
    country: headers.get('cf-ipcountry') || undefined, // Cloudflare country header
  };
}
