import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';

export const runtime = 'edge';

// GET /api/admin/audit-logs - List audit logs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.AUDIT_LOG_VIEW);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    // Filters
    const adminEmail = searchParams.get('adminEmail');
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where conditions
    const conditions = [];
    if (adminEmail) conditions.push(eq(auditLogs.adminEmail, adminEmail));
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
    if (resourceId) conditions.push(eq(auditLogs.resourceId, resourceId));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (startDate) conditions.push(gte(auditLogs.timestamp, new Date(startDate)));
    if (endDate) conditions.push(lte(auditLogs.timestamp, new Date(endDate)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch logs
    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countQuery = whereClause
      ? db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(whereClause)
      : db.select({ count: sql<number>`count(*)::int` }).from(auditLogs);

    const [{ count }] = await countQuery;
    const totalPages = Math.ceil(count / limit);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

// GET /api/admin/audit-logs/stats - Get audit log statistics
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.AUDIT_LOG_VIEW);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get action counts
    const actionCounts = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, startDate))
      .groupBy(auditLogs.action);

    // Get resource type counts
    const resourceTypeCounts = await db
      .select({
        resourceType: auditLogs.resourceType,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, startDate))
      .groupBy(auditLogs.resourceType);

    // Get top admins
    const topAdmins = await db
      .select({
        adminEmail: auditLogs.adminEmail,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, startDate))
      .groupBy(auditLogs.adminEmail)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    return NextResponse.json({
      actionCounts,
      resourceTypeCounts,
      topAdmins,
      period: `${days} days`,
    });
  } catch (error) {
    console.error('Failed to fetch audit log stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log stats' },
      { status: 500 }
    );
  }
}
