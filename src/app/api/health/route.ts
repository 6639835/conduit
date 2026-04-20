import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { kv } from '@vercel/kv';
import { sql } from 'drizzle-orm';
import { formatHealthCheckError } from '@/lib/env';

export const runtime = 'edge';

/**
 * GET /api/health - Health check endpoint
 * Returns system status and health of dependencies
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Check database connection
  try {
    const dbStart = Date.now();
    await db.execute(sql`select 1`);
    checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: formatHealthCheckError(error),
    };
  }

  // Check KV (Redis) connection
  try {
    const kvStart = Date.now();
    const healthCheckKey = `health_check:${crypto.randomUUID()}`;
    await kv.set(healthCheckKey, Date.now(), { ex: 10 });
    await kv.get(healthCheckKey);
    await kv.del(healthCheckKey);
    checks.redis = {
      status: 'healthy',
      latency: Date.now() - kvStart,
    };
  } catch (error) {
    checks.redis = {
      status: 'unhealthy',
      error: formatHealthCheckError(error),
    };
  }

  const overallStatus = Object.values(checks).every((check) => check.status === 'healthy')
    ? 'healthy'
    : 'degraded';

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      checks,
    },
    {
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
