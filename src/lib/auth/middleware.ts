import { NextResponse } from 'next/server';
import { auth } from './index';
import { db } from '@/lib/db';
import { admins } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Session } from 'next-auth';
import {
  Permission,
  Role,
  hasPermission,
  hasAllPermissions,
  canAccessOrganization,
  getPermissionErrorMessage,
  type AdminContext,
  normalizeRole,
} from './rbac';

type RequireAuthResult =
  | { authenticated: false; response: NextResponse; session?: undefined; adminContext?: undefined }
  | { authenticated: true; response?: undefined; session: Session; adminContext: AdminContext };

/**
 * Middleware to check if user is authenticated as an admin
 * Returns the session and admin context if authenticated, or an error response if not
 */
export async function requireAuth(): Promise<RequireAuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authenticated: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Please log in to access this resource.',
        },
        { status: 401 }
      ),
    };
  }

  const [admin] = await db
    .select({
      id: admins.id,
      isActive: admins.isActive,
      role: admins.role,
      organizationId: admins.organizationId,
      permissions: admins.permissions,
    })
    .from(admins)
    .where(eq(admins.id, session.user.id))
    .limit(1);

  if (!admin || !admin.isActive) {
    return {
      authenticated: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Forbidden. Admin access required.',
        },
        { status: 403 }
      ),
    };
  }

  const adminContext: AdminContext = {
    id: admin.id,
    role: normalizeRole(admin.role),
    organizationId: admin.organizationId,
    permissions: admin.permissions as string[] | undefined,
  };

  return {
    authenticated: true,
    session,
    adminContext,
  };
}

type CheckAuthResult =
  | { error: NextResponse; session?: undefined; adminContext?: undefined }
  | { error?: undefined; session: Session; adminContext: AdminContext };

/**
 * Helper function to check authentication and return early if not authenticated
 * Usage:
 * const authResult = await checkAuth();
 * if (authResult.error) return authResult.error;
 * // Now you can use authResult.session and authResult.adminContext
 */
export async function checkAuth(): Promise<CheckAuthResult> {
  const result = await requireAuth();

  if (!result.authenticated) {
    return {
      error: result.response,
    };
  }

  return {
    session: result.session,
    adminContext: result.adminContext,
  };
}

// ============================================================================
// Permission Checking Middleware
// ============================================================================

type RequirePermissionResult =
  | { authorized: false; response: NextResponse; adminContext?: undefined }
  | { authorized: true; response?: undefined; adminContext: AdminContext };

/**
 * Middleware to check if user has a specific permission
 *
 * Usage:
 * const result = await requirePermission(Permission.API_KEY_CREATE);
 * if (!result.authorized) return result.response;
 * // User has permission, proceed
 */
export async function requirePermission(
  permission: Permission
): Promise<RequirePermissionResult> {
  const authResult = await requireAuth();

  if (!authResult.authenticated) {
    return {
      authorized: false,
      response: authResult.response,
    };
  }

  const { adminContext } = authResult;

  if (!hasPermission(adminContext, permission)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: getPermissionErrorMessage(permission),
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    adminContext,
  };
}

/**
 * Middleware to check if user has ALL of the specified permissions
 */
export async function requirePermissions(
  permissions: Permission[]
): Promise<RequirePermissionResult> {
  const authResult = await requireAuth();

  if (!authResult.authenticated) {
    return {
      authorized: false,
      response: authResult.response,
    };
  }

  const { adminContext } = authResult;

  if (!hasAllPermissions(adminContext, permissions)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'You do not have the required permissions to perform this action.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    adminContext,
  };
}

/**
 * Middleware to check if user has a specific role
 */
export async function requireRole(role: Role): Promise<RequirePermissionResult> {
  const authResult = await requireAuth();

  if (!authResult.authenticated) {
    return {
      authorized: false,
      response: authResult.response,
    };
  }

  const { adminContext } = authResult;

  if (adminContext.role !== role) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: `This action requires ${role} role.`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    adminContext,
  };
}

/**
 * Middleware to check organization access
 *
 * Super admins have access to all organizations
 * Other admins can only access their own organization
 */
export async function requireOrganizationAccess(
  organizationId: string | null
): Promise<RequirePermissionResult> {
  const authResult = await requireAuth();

  if (!authResult.authenticated) {
    return {
      authorized: false,
      response: authResult.response,
    };
  }

  const { adminContext } = authResult;

  if (!canAccessOrganization(adminContext, organizationId)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'You do not have access to this organization.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    adminContext,
  };
}

// ============================================================================
// Combined Checking Helper
// ============================================================================

type CheckPermissionResult =
  | { error: NextResponse; adminContext?: undefined }
  | { error?: undefined; adminContext: AdminContext };

/**
 * Helper function to check permission and return early if not authorized
 * Usage:
 * const result = await checkPermission(Permission.API_KEY_CREATE);
 * if (result.error) return result.error;
 * // Now you can use result.adminContext
 */
export async function checkPermission(permission: Permission): Promise<CheckPermissionResult> {
  const result = await requirePermission(permission);

  if (!result.authorized) {
    return {
      error: result.response,
    };
  }

  return {
    adminContext: result.adminContext,
  };
}
