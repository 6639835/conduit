import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { db } from '@/lib/db';
import { customDashboards } from '@/lib/db/schema';
import { eq, and, or, desc, ne } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const widgetSchema = z.object({
  id: z.string(),
  type: z.enum(['metric', 'line-chart', 'bar-chart', 'donut-chart', 'table']),
  title: z.string(),
  config: z.object({
    dataSource: z.string(),
    refreshInterval: z.number().optional(),
    filters: z.record(z.string(), z.any()).optional(),
  }).passthrough(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
});

const createDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  layout: z.record(z.string(), z.any()),
  widgets: z.array(widgetSchema),
  visibility: z.enum(['private', 'organization', 'public']).default('private'),
  organizationId: z.string().uuid().optional(),
  refreshInterval: z.number().min(30).max(3600).default(300),
  theme: z.enum(['light', 'dark', 'auto']).default('light'),
  isDefault: z.boolean().default(false),
});

const updateDashboardSchema = createDashboardSchema.partial();

type DashboardRow = typeof customDashboards.$inferSelect;

interface DashboardResponse {
  success: boolean;
  dashboard?: DashboardRow;
  dashboards?: DashboardRow[];
  error?: string;
}

/**
 * GET /api/admin/dashboards - List all dashboards
 * Requires: DASHBOARD_READ permission
 * Query params: visibility, organizationId
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.DASHBOARD_READ);
    if (!authResult.authorized) return authResult.response;

    const adminId = authResult.adminContext.id;
    const { searchParams } = new URL(request.url);
    const visibility = searchParams.get('visibility');
    const organizationId = searchParams.get('organizationId');

    // User can see their own dashboards, org dashboards (when scoped), and public dashboards
    const accessOrConditions = [
      eq(customDashboards.createdBy, adminId),
      eq(customDashboards.visibility, 'public'),
      ...(organizationId
        ? [and(eq(customDashboards.visibility, 'organization'), eq(customDashboards.organizationId, organizationId))]
        : []),
    ];
    const conditions = [or(...accessOrConditions)];

    // Filter by visibility if provided
    const visibilityFilter =
      visibility === 'private' || visibility === 'organization' || visibility === 'public'
        ? visibility
        : null;
    if (visibilityFilter) {
      conditions.push(eq(customDashboards.visibility, visibilityFilter));
    }

    const dashboards = await db
      .select()
      .from(customDashboards)
      .where(and(...conditions))
      .orderBy(desc(customDashboards.updatedAt));

    return NextResponse.json(
      {
        success: true,
        dashboards,
      } as DashboardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboards',
      } as DashboardResponse,
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/dashboards - Create a new dashboard
 * Requires: DASHBOARD_CREATE permission
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.DASHBOARD_CREATE);
    if (!authResult.authorized) return authResult.response;

    const adminId = authResult.adminContext.id;
    const body = await request.json();

    const validationResult = createDashboardSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid dashboard data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as DashboardResponse,
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Generate share token if public
    const shareToken = data.visibility === 'public'
      ? randomBytes(32).toString('hex')
      : null;

    // If setting as default, unset other defaults for this user
    if (data.isDefault) {
      await db
        .update(customDashboards)
        .set({ isDefault: false })
        .where(eq(customDashboards.createdBy, adminId));
    }

    const [dashboard] = await db
      .insert(customDashboards)
      .values({
        name: data.name,
        description: data.description || null,
        layout: data.layout,
        widgets: data.widgets,
        visibility: data.visibility,
        organizationId: data.organizationId || null,
        refreshInterval: data.refreshInterval,
        theme: data.theme,
        isDefault: data.isDefault,
        shareToken,
        createdBy: adminId,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        dashboard,
      } as DashboardResponse,
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating dashboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create dashboard',
      } as DashboardResponse,
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/dashboards/:id - Update a dashboard
 * Requires: DASHBOARD_UPDATE permission
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.DASHBOARD_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const adminId = authResult.adminContext.id;
    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get('id');

    if (!dashboardId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dashboard ID is required',
        } as DashboardResponse,
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = updateDashboardSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid dashboard data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as DashboardResponse,
        { status: 400 }
      );
    }

    // Check if user owns the dashboard
    const [existing] = await db
      .select()
      .from(customDashboards)
      .where(eq(customDashboards.id, dashboardId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dashboard not found',
        } as DashboardResponse,
        { status: 404 }
      );
    }

    if (existing.createdBy !== adminId) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to update this dashboard',
        } as DashboardResponse,
        { status: 403 }
      );
    }

    const data = validationResult.data;

    // If setting as default, unset other defaults for this user
    if (data.isDefault) {
      await db
        .update(customDashboards)
        .set({ isDefault: false })
        .where(and(eq(customDashboards.createdBy, adminId), ne(customDashboards.id, dashboardId)));
    }

    const nextVisibility = data.visibility ?? existing.visibility;
    const nextShareToken =
      nextVisibility === 'public'
        ? existing.shareToken ?? randomBytes(32).toString('hex')
        : null;
    const nextOrganizationId =
      nextVisibility === 'organization'
        ? (data.organizationId ?? existing.organizationId)
        : null;

    const [updated] = await db
      .update(customDashboards)
      .set({
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        layout: data.layout ?? undefined,
        widgets: data.widgets ?? undefined,
        visibility: data.visibility ?? undefined,
        organizationId: nextOrganizationId,
        refreshInterval: data.refreshInterval ?? undefined,
        theme: data.theme ?? undefined,
        isDefault: data.isDefault ?? undefined,
        shareToken: nextShareToken,
        updatedAt: new Date(),
      })
      .where(eq(customDashboards.id, dashboardId))
      .returning();

    return NextResponse.json(
      {
        success: true,
        dashboard: updated,
      } as DashboardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating dashboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update dashboard',
      } as DashboardResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/dashboards/:id - Delete a dashboard
 * Requires: DASHBOARD_DELETE permission
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.DASHBOARD_DELETE);
    if (!authResult.authorized) return authResult.response;

    const adminId = authResult.adminContext.id;
    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get('id');

    if (!dashboardId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dashboard ID is required',
        } as DashboardResponse,
        { status: 400 }
      );
    }

    // Check if user owns the dashboard
    const [existing] = await db
      .select()
      .from(customDashboards)
      .where(eq(customDashboards.id, dashboardId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dashboard not found',
        } as DashboardResponse,
        { status: 404 }
      );
    }

    if (existing.createdBy !== adminId) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to delete this dashboard',
        } as DashboardResponse,
        { status: 403 }
      );
    }

    await db
      .delete(customDashboards)
      .where(eq(customDashboards.id, dashboardId));

    return NextResponse.json(
      {
        success: true,
      } as DashboardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete dashboard',
      } as DashboardResponse,
      { status: 500 }
    );
  }
}
