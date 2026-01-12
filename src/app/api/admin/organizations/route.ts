import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { checkAuth } from '@/lib/auth/middleware';

export const runtime = 'edge';

// GET /api/admin/organizations - List all organizations
export async function GET() {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const orgs = await db.select().from(organizations).orderBy(organizations.createdAt);

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
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

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
      adminEmail: session.user.email ?? undefined,
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
