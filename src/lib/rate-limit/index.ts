/**
 * Rate limiting implementation using Vercel KV (Redis)
 * Enforces per-minute and per-day request limits at the edge
 */

import { kv } from '@vercel/kv';
import type { ApiKey } from '@/lib/db/schema';
import type { RateLimitResult } from '@/types';

/**
 * Check rate limits for an API key
 * Returns whether the request is allowed and remaining quota
 */
export async function checkRateLimit(apiKey: ApiKey): Promise<RateLimitResult> {
  const now = Date.now();
  const currentMinute = Math.floor(now / 60000); // 60 seconds
  const currentDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const minuteKey = `rate_limit:${apiKey.id}:minute:${currentMinute}`;
  const dayKey = `rate_limit:${apiKey.id}:day:${currentDay}`;

  try {
    // Get current counters (use pipeline for atomicity)
    const results = await kv
      .pipeline()
      .incr(minuteKey)
      .incr(dayKey)
      .exec();

    const minuteCount = results[0] as number;
    const dayCount = results[1] as number;

    // Set TTL on first increment (idempotent - only sets if no TTL exists)
    if (minuteCount === 1) {
      await kv.expire(minuteKey, 120); // 2 minutes TTL (safety margin)
    }
    if (dayCount === 1) {
      await kv.expire(dayKey, 86400 * 2); // 2 days TTL (safety margin)
    }

    // Check minute limit
    const minuteLimit = apiKey.requestsPerMinute || 60;
    if (minuteCount > minuteLimit) {
      const resetTime = (currentMinute + 1) * 60000; // Next minute
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      return {
        allowed: false,
        limit: minuteLimit,
        remaining: 0,
        reset: Math.floor(resetTime / 1000),
        retryAfter,
      };
    }

    // Check day limit
    const dayLimit = apiKey.requestsPerDay || 1000;
    if (dayCount > dayLimit) {
      const tomorrow = new Date(currentDay);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const resetTime = tomorrow.getTime();
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      return {
        allowed: false,
        limit: dayLimit,
        remaining: 0,
        reset: Math.floor(resetTime / 1000),
        retryAfter,
      };
    }

    // Request allowed
    return {
      allowed: true,
      limit: minuteLimit,
      remaining: minuteLimit - minuteCount,
      reset: Math.floor(((currentMinute + 1) * 60000) / 1000),
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open: allow request if KV is unavailable
    return {
      allowed: true,
    };
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  if (result.limit !== undefined) {
    headers.set('X-RateLimit-Limit', result.limit.toString());
  }
  if (result.remaining !== undefined) {
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
  }
  if (result.reset !== undefined) {
    headers.set('X-RateLimit-Reset', result.reset.toString());
  }
  if (result.retryAfter !== undefined) {
    headers.set('Retry-After', result.retryAfter.toString());
  }
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  addRateLimitHeaders(headers, result);

  return new Response(
    JSON.stringify({
      error: {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded. Please try again later.',
      },
    }),
    {
      status: 429,
      headers,
    }
  );
}
