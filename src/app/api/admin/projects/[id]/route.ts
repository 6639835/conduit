import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';
import { checkAuth } from '@/lib/auth/middleware';

export const runtime = 'edge';

// GET /api/admin/projects/[id] - Get a single project
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Failed to fetch project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/projects/[id] - Update a project
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const { id } = await context.params;
    const body = await request.json();
    const { name, sharedQuotas } = body;

    const updateData: Partial<typeof projects.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (sharedQuotas !== undefined) updateData.sharedQuotas = sharedQuotas;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Log audit
    await logAudit({
      adminEmail: session.user.email,
      resourceType: 'project',
      resourceId: project.id,
      action: 'update',
      changes: updateData,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/projects/[id] - Delete a project
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const [project] = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Log audit
    await logAudit({
      adminEmail: session.user.email,
      resourceType: 'project',
      resourceId: project.id,
      action: 'delete',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
