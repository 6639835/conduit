import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usageLogs, apiKeys } from '@/lib/db/schema';
import { desc, gte, and, eq } from 'drizzle-orm';

/**
 * GET /api/admin/analytics/export?format=csv|json&days=7
 * Export usage data in CSV or JSON format
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'csv';
    const days = parseInt(searchParams.get('days') || '7');
    const apiKeyId = searchParams.get('apiKeyId');

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query
    let query = db
      .select({
        id: usageLogs.id,
        timestamp: usageLogs.timestamp,
        apiKeyId: usageLogs.apiKeyId,
        keyPrefix: apiKeys.keyPrefix,
        method: usageLogs.method,
        path: usageLogs.path,
        model: usageLogs.model,
        tokensInput: usageLogs.tokensInput,
        tokensOutput: usageLogs.tokensOutput,
        costUsd: usageLogs.costUsd,
        latencyMs: usageLogs.latencyMs,
        statusCode: usageLogs.statusCode,
        errorMessage: usageLogs.errorMessage,
        userAgent: usageLogs.userAgent,
        ipAddress: usageLogs.ipAddress,
        country: usageLogs.country,
      })
      .from(usageLogs)
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id))
      .where(gte(usageLogs.timestamp, startDate))
      .orderBy(desc(usageLogs.timestamp))
      .limit(10000); // Limit to 10k records

    // Filter by API key if specified
    if (apiKeyId) {
      query = query.where(
        and(
          gte(usageLogs.timestamp, startDate),
          eq(usageLogs.apiKeyId, apiKeyId)
        )
      );
    }

    const logs = await query;

    if (format === 'json') {
      // JSON export
      return NextResponse.json({
        success: true,
        data: logs,
        exportedAt: new Date().toISOString(),
        recordCount: logs.length,
      });
    } else {
      // CSV export
      const csvHeaders = [
        'Timestamp',
        'API Key',
        'Method',
        'Path',
        'Model',
        'Tokens Input',
        'Tokens Output',
        'Cost (USD)',
        'Latency (ms)',
        'Status Code',
        'Error',
        'User Agent',
        'IP Address',
        'Country',
      ].join(',');

      const csvRows = logs.map((log) => {
        return [
          log.timestamp?.toISOString() || '',
          log.keyPrefix || '',
          log.method || '',
          log.path || '',
          log.model || '',
          log.tokensInput || 0,
          log.tokensOutput || 0,
          ((log.costUsd || 0) / 100).toFixed(4),
          log.latencyMs || 0,
          log.statusCode || '',
          `"${(log.errorMessage || '').replace(/"/g, '""')}"`,
          `"${(log.userAgent || '').replace(/"/g, '""')}"`,
          log.ipAddress || '',
          log.country || '',
        ].join(',');
      });

      const csv = [csvHeaders, ...csvRows].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="usage-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
