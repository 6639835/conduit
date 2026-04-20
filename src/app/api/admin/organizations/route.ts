import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission, Role } from '@/lib/auth/rbac';
import { eq, sql } from 'drizzle-orm';

export const runtime = 'edge';

// GET /api/admin/organizations - List all organizations
export async function GET() {
  try {
    const authResult = await requirePermission(Permission.ORG_READ);
    if (!authResult.authorized) return authResult.response;
    const whereClause = authResult.adminContext.role === Role.SUPER_ADMIN
      ? undefined
      : authResult.adminContext.organizationId
        ? eq(organizations.id, authResult.adminContext.organizationId)
        : sql`false`;

    const orgs = await db
      .select()
      .from(organizations)
      .where(whereClause)
      .orderBy(organizations.createdAt);

    return NextResponse.json({ organizations: orgs });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

// POST /api/admin/organizations - Create a new organization
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ORG_CREATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const { name, slug, plan, maxApiKeys, maxUsers } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const [org] = await db
      .insert(organizations)
      .values({
        name,
        slug,
        plan: plan || 'free',
        maxApiKeys: maxApiKeys || 10,
        maxUsers: maxUsers || 5,
      })
      .returning();

    // Log audit
    await logAudit({
      adminId: authResult.adminContext.id,
      resourceType: 'organization',
      resourceId: org.id,
      action: 'create',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ organization: org }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    console.error('Failed to create organization:', error);

    if (err.code === '23505') {
      // Unique constraint violation
      return NextResponse.json(
        { error: 'Organization slug already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
