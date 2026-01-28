import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth/middleware';
import { Role, ROLE_PERMISSIONS, ROLE_INFO, Permission } from '@/lib/auth/rbac';

/**
 * GET /api/admin/roles
 * Get all available roles and their permissions
 *
 * Returns:
 * - List of roles with metadata
 * - Permission matrix
 */
export async function GET(_request: NextRequest) {
  const authResult = await checkAuth();
  if (authResult.error) return authResult.error;

  // Any authenticated admin can view roles
  const roles = Object.values(Role).map(role => ({
    id: role,
    label: ROLE_INFO[role].label,
    description: ROLE_INFO[role].description,
    color: ROLE_INFO[role].color,
    bgColor: ROLE_INFO[role].bgColor,
    permissions: ROLE_PERMISSIONS[role],
    permissionCount: ROLE_PERMISSIONS[role].length,
  }));

  // Get all permissions for the permission matrix
  const allPermissions = Object.values(Permission);

  // Group permissions by category
  const permissionsByCategory: Record<string, Permission[]> = {};

  allPermissions.forEach(permission => {
    const [category] = permission.split(':');
    if (!permissionsByCategory[category]) {
      permissionsByCategory[category] = [];
    }
    permissionsByCategory[category].push(permission);
  });

  return NextResponse.json({
    success: true,
    data: {
      roles,
      permissions: allPermissions,
      permissionsByCategory,
      currentAdminRole: authResult.adminContext.role,
    },
  });
}
