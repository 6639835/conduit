import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, usageLogs, providers } from '@/lib/db/schema';
import { sql, gte } from 'drizzle-orm';

export const runtime = 'edge';

/**
 * GET /api/metrics - Prometheus-compatible metrics endpoint
 * Returns key performance metrics for monitoring
 */
export async function GET() {
  try {
    // Get current timestamp for 24h lookback
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Count total and active API keys
    const [keyStats] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where is_active = true)`,
      })
      .from(apiKeys);

    // Count total and active providers
    const [providerStats] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where is_active = true)`,
        healthy: sql<number>`count(*) filter (where status = 'healthy')`,
      })
      .from(providers);

    // Get 24h request stats
    const [requestStats] = await db
      .select({
        total: sql<number>`count(*)`,
        successful: sql<number>`count(*) filter (where status_code between 200 and 299)`,
        failed: sql<number>`count(*) filter (where status_code >= 400)`,
        avgLatency: sql<number>`avg(latency_ms)`,
        totalTokens: sql<number>`sum(tokens_input + tokens_output)`,
        totalCost: sql<number>`sum(cost_usd)`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.timestamp, oneDayAgo));

    // Format as Prometheus metrics
    const metrics = [
      '# HELP conduit_api_keys_total Total number of API keys',
      '# TYPE conduit_api_keys_total gauge',
      `conduit_api_keys_total{status="total"} ${keyStats?.total || 0}`,
      `conduit_api_keys_total{status="active"} ${keyStats?.active || 0}`,
      '',
      '# HELP conduit_providers_total Total number of providers',
      '# TYPE conduit_providers_total gauge',
      `conduit_providers_total{status="total"} ${providerStats?.total || 0}`,
      `conduit_providers_total{status="active"} ${providerStats?.active || 0}`,
      `conduit_providers_total{status="healthy"} ${providerStats?.healthy || 0}`,
      '',
      '# HELP conduit_requests_total Total number of requests (24h)',
      '# TYPE conduit_requests_total counter',
      `conduit_requests_total ${requestStats?.total || 0}`,
      '',
      '# HELP conduit_requests_successful Successful requests (24h)',
      '# TYPE conduit_requests_successful counter',
      `conduit_requests_successful ${requestStats?.successful || 0}`,
      '',
      '# HELP conduit_requests_failed Failed requests (24h)',
      '# TYPE conduit_requests_failed counter',
      `conduit_requests_failed ${requestStats?.failed || 0}`,
      '',
      '# HELP conduit_request_latency_ms Average request latency in milliseconds (24h)',
      '# TYPE conduit_request_latency_ms gauge',
      `conduit_request_latency_ms ${requestStats?.avgLatency || 0}`,
      '',
      '# HELP conduit_tokens_total Total tokens processed (24h)',
      '# TYPE conduit_tokens_total counter',
      `conduit_tokens_total ${requestStats?.totalTokens || 0}`,
      '',
      '# HELP conduit_cost_usd_total Total cost in cents (24h)',
      '# TYPE conduit_cost_usd_total counter',
      `conduit_cost_usd_total ${requestStats?.totalCost || 0}`,
    ].join('\n');

    return new NextResponse(metrics, {
      headers: {
        'Content-Type': 'text/plain; version=1.0.0',
      },
    });
  } catch (error) {
    console.error('Error generating metrics:', error);
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}
