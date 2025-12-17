import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { kv } from '@vercel/kv';

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
    await db.execute('SELECT 1');
    checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check KV (Redis) connection
  try {
    const kvStart = Date.now();
    await kv.set('health_check', Date.now(), { ex: 10 });
    await kv.get('health_check');
    checks.redis = {
      status: 'healthy',
      latency: Date.now() - kvStart,
    };
  } catch (error) {
    checks.redis = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
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
    { status: overallStatus === 'healthy' ? 200 : 503 }
  );
}
