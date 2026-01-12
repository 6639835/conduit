import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';
import { checkAuth } from '@/lib/auth/middleware';

export const runtime = 'edge';

// GET /api/admin/organizations/[id] - Get a single organization
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organization: org });
  } catch (error) {
    console.error('Failed to fetch organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/organizations/[id] - Update an organization
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const body = await request.json();
    const { name, slug, plan, maxApiKeys, maxUsers, isActive } = body;

    const updateData: Partial<typeof organizations.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (plan !== undefined) updateData.plan = plan;
    if (maxApiKeys !== undefined) updateData.maxApiKeys = maxApiKeys;
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const [org] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, id))
      .returning();

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Log audit
    await logAudit({
      adminEmail: session.user.email,
      resourceType: 'organization',
      resourceId: org.id,
      action: 'update',
      changes: updateData,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ organization: org });
  } catch (error: unknown) {
    const err = error as { code?: string };
    console.error('Failed to update organization:', error);

    if (err.code === '23505') {
      return NextResponse.json(
        { error: 'Organization slug already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/organizations/[id] - Delete an organization
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const [org] = await db
      .delete(organizations)
      .where(eq(organizations.id, id))
      .returning();

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Log audit
    await logAudit({
      adminEmail: session.user.email,
      resourceType: 'organization',
      resourceId: org.id,
      action: 'delete',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete organization:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
