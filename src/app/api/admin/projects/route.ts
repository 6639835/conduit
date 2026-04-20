import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, organizations } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireOrganizationAccess } from '@/lib/auth/middleware';
import { Permission, Role } from '@/lib/auth/rbac';

export const runtime = 'edge';

// GET /api/admin/projects - List all projects (with optional org filter)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ORG_READ);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const scopedOrganizationId =
      authResult.adminContext.role === Role.SUPER_ADMIN
        ? organizationId
        : authResult.adminContext.organizationId;
    const whereClause =
      authResult.adminContext.role !== Role.SUPER_ADMIN && !authResult.adminContext.organizationId
        ? sql`false`
        : organizationId && scopedOrganizationId !== organizationId
          ? sql`false`
          : scopedOrganizationId
            ? eq(projects.organizationId, scopedOrganizationId)
            : undefined;

    const results = await db
      .select({
        project: projects,
        organization: organizations,
      })
      .from(projects)
      .leftJoin(organizations, eq(projects.organizationId, organizations.id))
      .$dynamic()
      .where(whereClause)
      .orderBy(desc(projects.createdAt));

    return NextResponse.json({
      projects: results.map((r) => ({
        ...r.project,
        organization: r.organization,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/admin/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ORG_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const { name, organizationId, sharedQuotas } = body;

    if (!name || !organizationId) {
      return NextResponse.json(
        { error: 'Name and organizationId are required' },
        { status: 400 }
      );
    }

    const orgAccessResult = await requireOrganizationAccess(organizationId);
    if (!orgAccessResult.authorized) return orgAccessResult.response;

    // Verify organization exists
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const [project] = await db
      .insert(projects)
      .values({
        name,
        organizationId,
        sharedQuotas: sharedQuotas || null,
      })
      .returning();

    // Log audit
    await logAudit({
      adminId: authResult.adminContext.id,
      resourceType: 'project',
      resourceId: project.id,
      action: 'create',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
