import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, organizations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';
import { checkAuth } from '@/lib/auth/middleware';

export const runtime = 'edge';

// GET /api/admin/projects - List all projects (with optional org filter)
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    const results = await db
      .select({
        project: projects,
        organization: organizations,
      })
      .from(projects)
      .leftJoin(organizations, eq(projects.organizationId, organizations.id))
      .$dynamic()
      .where(organizationId ? eq(projects.organizationId, organizationId) : undefined)
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
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const body = await request.json();
    const { name, organizationId, sharedQuotas } = body;

    if (!name || !organizationId) {
      return NextResponse.json(
        { error: 'Name and organizationId are required' },
        { status: 400 }
      );
    }

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
      adminEmail: session.user.email ?? undefined,
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
