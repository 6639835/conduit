import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usageLogs, apiKeys, admins } from '@/lib/db/schema';
import { desc, gte, eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/auth/middleware';

interface ActivityItem {
  id: string;
  type: 'api_request' | 'key_created' | 'key_revoked' | 'user_added' | 'provider_added';
  description: string;
  timestamp: string;
  metadata?: {
    keyPrefix?: string;
    email?: string;
    provider?: string;
    model?: string;
    status?: 'success' | 'error';
  };
}

interface ActivityResponse {
  success: boolean;
  error?: string;
  activities?: ActivityItem[];
}

/**
 * GET /api/admin/activity
 * Get recent activity logs across the system
 *
 * Query params:
 * - limit: number of activities to return (default: 50)
 * - days: number of days to look back (default: 7)
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await checkAuth();
  if (authResult.error) return authResult.error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const daysParam = searchParams.get('days');

    const limit = limitParam ? parseInt(limitParam) : 50;
    const days = daysParam ? parseInt(daysParam) : 7;

    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities: ActivityItem[] = [];

    // Fetch recent API requests from usage logs
    const recentLogs = await db
      .select({
        id: usageLogs.id,
        apiKeyId: usageLogs.apiKeyId,
        model: usageLogs.model,
        path: usageLogs.path,
        statusCode: usageLogs.statusCode,
        tokensInput: usageLogs.tokensInput,
        tokensOutput: usageLogs.tokensOutput,
        timestamp: usageLogs.timestamp,
      })
      .from(usageLogs)
      .where(gte(usageLogs.timestamp, startDate))
      .orderBy(desc(usageLogs.timestamp))
      .limit(Math.min(limit, 100));

    // Enrich with API key information
    for (const log of recentLogs) {
      const [key] = await db
        .select({
          keyPrefix: apiKeys.keyPrefix,
          provider: apiKeys.provider,
        })
        .from(apiKeys)
        .where(eq(apiKeys.id, log.apiKeyId))
        .limit(1);

      if (key) {
        const isSuccess = log.statusCode < 400;
        const totalTokens = log.tokensInput + log.tokensOutput;

        activities.push({
          id: log.id,
          type: 'api_request',
          description: `API request to ${log.path} - ${totalTokens.toLocaleString()} tokens`,
          timestamp: log.timestamp.toISOString(),
          metadata: {
            keyPrefix: key.keyPrefix,
            provider: key.provider ?? undefined,
            model: log.model,
            status: isSuccess ? 'success' : 'error',
          },
        });
      }
    }

    // Fetch recently created API keys
    const recentKeys = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
        provider: apiKeys.provider,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(gte(apiKeys.createdAt, startDate))
      .orderBy(desc(apiKeys.createdAt))
      .limit(20);

    for (const key of recentKeys) {
      if (key.revokedAt && key.revokedAt >= startDate) {
        activities.push({
          id: `key-revoked-${key.id}`,
          type: 'key_revoked',
          description: `API key ${key.name || key.keyPrefix} was revoked`,
          timestamp: key.revokedAt.toISOString(),
          metadata: {
            keyPrefix: key.keyPrefix,
            provider: key.provider ?? undefined,
          },
        });
      }

      activities.push({
        id: `key-created-${key.id}`,
        type: 'key_created',
        description: `New API key created: ${key.name || key.keyPrefix}`,
        timestamp: key.createdAt.toISOString(),
        metadata: {
          keyPrefix: key.keyPrefix,
          provider: key.provider ?? undefined,
        },
      });
    }

    // Fetch recently created admin users
    const recentAdmins = await db
      .select({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        createdAt: admins.createdAt,
      })
      .from(admins)
      .where(gte(admins.createdAt, startDate))
      .orderBy(desc(admins.createdAt))
      .limit(20);

    for (const admin of recentAdmins) {
      activities.push({
        id: `user-added-${admin.id}`,
        type: 'user_added',
        description: `New admin user added: ${admin.name || admin.email}`,
        timestamp: admin.createdAt.toISOString(),
        metadata: {
          email: admin.email,
        },
      });
    }

    // Sort all activities by timestamp (newest first) and limit
    activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const limitedActivities = activities.slice(0, limit);

    return NextResponse.json(
      {
        success: true,
        activities: limitedActivities,
      } as ActivityResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch activity logs',
      } as ActivityResponse,
      { status: 500 }
    );
  }
}
