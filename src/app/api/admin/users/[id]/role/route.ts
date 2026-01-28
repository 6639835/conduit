import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission, Role, canManageAdmin, isRoleAtLeast, normalizeRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db';
import { admins } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateRoleSchema = z.object({
  role: z.enum([Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.VIEWER]),
});

/**
 * PATCH /api/admin/users/[id]/role
 * Update an admin user's role
 *
 * Body:
 * - role: The new role to assign
 *
 * Permission: ADMIN_MANAGE_ROLES
 *
 * Authorization rules:
 * - Super admins can change anyone's role
 * - Org admins can only change roles of users in their org to lower roles
 * - Viewers cannot change roles
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(Permission.ADMIN_MANAGE_ROLES);
  if (!authResult.authorized) return authResult.response;

  const { id: targetAdminId } = await params;

  try {
    const body = await request.json();
    const validation = updateRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { role: newRole } = validation.data;

    // Get target admin
    const [targetAdmin] = await db
      .select({
        id: admins.id,
        email: admins.email,
        role: admins.role,
        organizationId: admins.organizationId,
      })
      .from(admins)
      .where(eq(admins.id, targetAdminId))
      .limit(1);

    if (!targetAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin user not found',
        },
        { status: 404 }
      );
    }

    // Check if current admin can manage the target admin
    const currentRole = authResult.adminContext.role;
    const targetRole = normalizeRole(targetAdmin.role);
    const targetOrgId = targetAdmin.organizationId;

    if (!canManageAdmin(authResult.adminContext, targetRole, targetOrgId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to manage this admin user.',
        },
        { status: 403 }
      );
    }

    // Check if current admin can assign the new role
    // Only super admins can create other super admins
    if (newRole === Role.SUPER_ADMIN && currentRole !== Role.SUPER_ADMIN) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only super admins can assign the super admin role.',
        },
        { status: 403 }
      );
    }

    // Org admins can only assign roles lower than their own
    if (currentRole === Role.ORG_ADMIN && !isRoleAtLeast(currentRole, newRole)) {
      return NextResponse.json(
        {
          success: false,
          error: 'You can only assign roles lower than or equal to your own.',
        },
        { status: 403 }
      );
    }

    // Prevent self-demotion for super admins (safety check)
    if (
      targetAdminId === authResult.adminContext.id &&
      currentRole === Role.SUPER_ADMIN &&
      newRole !== Role.SUPER_ADMIN
    ) {
      // Check if there are other super admins
      const superAdminCount = await db
        .select({ count: admins.id })
        .from(admins)
        .where(eq(admins.role, Role.SUPER_ADMIN));

      if (superAdminCount.length <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot remove the last super admin. Promote another admin first.',
          },
          { status: 400 }
        );
      }
    }

    // Update role
    await db
      .update(admins)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(admins.id, targetAdminId));

    // Log the change
    console.log(
      `[RBAC] Role changed: ${targetAdmin.email} (${targetRole} → ${newRole}) by ${authResult.adminContext.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Role updated to ${newRole}`,
      data: {
        adminId: targetAdminId,
        email: targetAdmin.email,
        previousRole: targetRole,
        newRole,
      },
    });
  } catch (error) {
    console.error('[API] Error updating admin role:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update role',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
