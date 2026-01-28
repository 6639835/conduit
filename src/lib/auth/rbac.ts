/**
 * Role-Based Access Control (RBAC) System
 *
 * Defines roles, permissions, and provides utilities for authorization checks
 */

import { db } from '@/lib/db';
import { admins } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// Role Definitions
// ============================================================================

export enum Role {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  VIEWER = 'viewer',
}

export const ROLE_HIERARCHY = {
  [Role.SUPER_ADMIN]: 3,
  [Role.ORG_ADMIN]: 2,
  [Role.VIEWER]: 1,
};

const LEGACY_ROLE_ALIASES: Record<string, Role> = {
  admin: Role.ORG_ADMIN,
};

// ============================================================================
// Permission Definitions
// ============================================================================

export enum Permission {
  // Admin Management
  ADMIN_CREATE = 'admin:create',
  ADMIN_READ = 'admin:read',
  ADMIN_UPDATE = 'admin:update',
  ADMIN_DELETE = 'admin:delete',
  ADMIN_MANAGE_ROLES = 'admin:manage_roles',

  // API Key Management
  API_KEY_CREATE = 'api_key:create',
  API_KEY_READ = 'api_key:read',
  API_KEY_UPDATE = 'api_key:update',
  API_KEY_DELETE = 'api_key:delete',
  API_KEY_ROTATE = 'api_key:rotate',

  // Organization Management
  ORG_CREATE = 'org:create',
  ORG_READ = 'org:read',
  ORG_UPDATE = 'org:update',
  ORG_DELETE = 'org:delete',
  ORG_MANAGE_USERS = 'org:manage_users',

  // Provider Management
  PROVIDER_CREATE = 'provider:create',
  PROVIDER_READ = 'provider:read',
  PROVIDER_UPDATE = 'provider:update',
  PROVIDER_DELETE = 'provider:delete',

  // Analytics & Reports
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',
  REPORTS_VIEW = 'reports:view',
  REPORTS_CREATE = 'reports:create',

  // Webhooks & Notifications
  WEBHOOK_CREATE = 'webhook:create',
  WEBHOOK_READ = 'webhook:read',
  WEBHOOK_UPDATE = 'webhook:update',
  WEBHOOK_DELETE = 'webhook:delete',

  // Dashboards
  DASHBOARD_CREATE = 'dashboard:create',
  DASHBOARD_READ = 'dashboard:read',
  DASHBOARD_UPDATE = 'dashboard:update',
  DASHBOARD_DELETE = 'dashboard:delete',

  // System Settings
  SETTINGS_READ = 'settings:read',
  SETTINGS_UPDATE = 'settings:update',
  SYSTEM_MANAGE = 'system:manage',

  // Compliance & Security
  AUDIT_LOG_VIEW = 'audit_log:view',
  COMPLIANCE_MANAGE = 'compliance:manage',
  SECURITY_MANAGE = 'security:manage',
}

// ============================================================================
// Role-Permission Mapping
// ============================================================================

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    // Super admin has ALL permissions
    ...Object.values(Permission),
  ],
  [Role.ORG_ADMIN]: [
    // Organization admin - can manage within their org
    Permission.ADMIN_READ,
    Permission.ADMIN_CREATE, // Can invite other admins to their org
    Permission.ADMIN_UPDATE, // Can update admins in their org

    Permission.API_KEY_CREATE,
    Permission.API_KEY_READ,
    Permission.API_KEY_UPDATE,
    Permission.API_KEY_DELETE,
    Permission.API_KEY_ROTATE,

    Permission.ORG_READ,
    Permission.ORG_UPDATE, // Can update their own org
    Permission.ORG_MANAGE_USERS,

    Permission.PROVIDER_READ,

    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_CREATE,

    Permission.WEBHOOK_CREATE,
    Permission.WEBHOOK_READ,
    Permission.WEBHOOK_UPDATE,
    Permission.WEBHOOK_DELETE,

    Permission.DASHBOARD_CREATE,
    Permission.DASHBOARD_READ,
    Permission.DASHBOARD_UPDATE,
    Permission.DASHBOARD_DELETE,

    Permission.SETTINGS_READ,
    Permission.SETTINGS_UPDATE,

    Permission.AUDIT_LOG_VIEW,
  ],
  [Role.VIEWER]: [
    // Viewer - read-only access
    Permission.ADMIN_READ,
    Permission.API_KEY_READ,
    Permission.ORG_READ,
    Permission.PROVIDER_READ,
    Permission.ANALYTICS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.WEBHOOK_READ,
    Permission.DASHBOARD_READ,
    Permission.SETTINGS_READ,
    Permission.AUDIT_LOG_VIEW,
  ],
};

// ============================================================================
// Permission Checking Functions
// ============================================================================

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function normalizeRole(role: string | null | undefined): Role {
  if (!role) {
    return Role.VIEWER;
  }

  const alias = LEGACY_ROLE_ALIASES[role];
  if (alias) {
    return alias;
  }

  if (Object.values(Role).includes(role as Role)) {
    return role as Role;
  }

  return Role.VIEWER;
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

/**
 * Check if a role is higher in hierarchy than another
 */
export function isRoleHigher(role1: Role, role2: Role): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}

/**
 * Check if a role is at least as high as another
 */
export function isRoleAtLeast(role1: Role, minimumRole: Role): boolean {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[minimumRole];
}

// ============================================================================
// User Permission Checking
// ============================================================================

export interface AdminContext {
  id: string;
  role: Role;
  organizationId?: string | null;
  permissions?: string[];
}

/**
 * Get admin context including role and permissions
 */
export async function getAdminContext(adminId: string): Promise<AdminContext | null> {
  const [admin] = await db
    .select({
      id: admins.id,
      role: admins.role,
      organizationId: admins.organizationId,
      permissions: admins.permissions,
    })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1);

  if (!admin) {
    return null;
  }

  return {
    id: admin.id,
    role: normalizeRole(admin.role),
    organizationId: admin.organizationId,
    permissions: admin.permissions as string[] | undefined,
  };
}

/**
 * Check if an admin has a specific permission
 * Considers both role-based permissions and custom permissions
 */
export function hasPermission(
  adminContext: AdminContext,
  permission: Permission
): boolean {
  // Check role-based permissions
  const rolePermissions = getRolePermissions(adminContext.role);
  if (rolePermissions.includes(permission)) {
    return true;
  }

  // Check custom permissions (can override role permissions)
  if (adminContext.permissions?.includes(permission)) {
    return true;
  }

  return false;
}

/**
 * Check if an admin has ANY of the specified permissions
 */
export function hasAnyPermission(
  adminContext: AdminContext,
  permissions: Permission[]
): boolean {
  return permissions.some(permission => hasPermission(adminContext, permission));
}

/**
 * Check if an admin has ALL of the specified permissions
 */
export function hasAllPermissions(
  adminContext: AdminContext,
  permissions: Permission[]
): boolean {
  return permissions.every(permission => hasPermission(adminContext, permission));
}

/**
 * Check if an admin can access a resource in a specific organization
 *
 * Rules:
 * - Super admins can access any organization
 * - Org admins and viewers can only access their own organization
 */
export function canAccessOrganization(
  adminContext: AdminContext,
  organizationId: string | null
): boolean {
  // Super admins have global access
  if (adminContext.role === Role.SUPER_ADMIN) {
    return true;
  }

  // If no organization specified, check if admin has one
  if (!organizationId) {
    return true; // Allow access to global resources
  }

  // Check if admin belongs to the organization
  return adminContext.organizationId === organizationId;
}

/**
 * Check if an admin can manage another admin
 *
 * Rules:
 * - Super admins can manage anyone
 * - Org admins can manage admins in their organization with lower role
 * - Viewers cannot manage anyone
 */
export function canManageAdmin(
  adminContext: AdminContext,
  targetAdminRole: Role,
  targetAdminOrgId?: string | null
): boolean {
  // Super admins can manage anyone
  if (adminContext.role === Role.SUPER_ADMIN) {
    return true;
  }

  // Viewers cannot manage anyone
  if (adminContext.role === Role.VIEWER) {
    return false;
  }

  // Org admins can only manage within their organization
  if (adminContext.role === Role.ORG_ADMIN) {
    // Must be in same organization
    if (adminContext.organizationId !== targetAdminOrgId) {
      return false;
    }

    // Can only manage lower roles
    return isRoleHigher(adminContext.role, targetAdminRole);
  }

  return false;
}

// ============================================================================
// Permission Error Messages
// ============================================================================

export function getPermissionErrorMessage(permission: Permission): string {
  return `You do not have permission to perform this action. Required permission: ${permission}`;
}

export function getOrganizationAccessErrorMessage(): string {
  return 'You do not have access to this organization.';
}

export function getAdminManagementErrorMessage(): string {
  return 'You do not have permission to manage this admin user.';
}

// ============================================================================
// Helper Types
// ============================================================================

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Comprehensive permission check with detailed reason
 */
export function checkPermission(
  adminContext: AdminContext,
  permission: Permission,
  options?: {
    organizationId?: string | null;
    targetAdminRole?: Role;
    targetAdminOrgId?: string | null;
  }
): PermissionCheck {
  // Check basic permission
  if (!hasPermission(adminContext, permission)) {
    return {
      allowed: false,
      reason: getPermissionErrorMessage(permission),
    };
  }

  // Check organization access if specified
  if (options?.organizationId !== undefined) {
    if (!canAccessOrganization(adminContext, options.organizationId)) {
      return {
        allowed: false,
        reason: getOrganizationAccessErrorMessage(),
      };
    }
  }

  // Check admin management if specified
  if (options?.targetAdminRole !== undefined) {
    if (!canManageAdmin(adminContext, options.targetAdminRole, options.targetAdminOrgId)) {
      return {
        allowed: false,
        reason: getAdminManagementErrorMessage(),
      };
    }
  }

  return {
    allowed: true,
  };
}

// ============================================================================
// Role Display Information
// ============================================================================

export const ROLE_INFO = {
  [Role.SUPER_ADMIN]: {
    label: 'Super Admin',
    description: 'Full system access across all organizations',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  [Role.ORG_ADMIN]: {
    label: 'Organization Admin',
    description: 'Full access within assigned organization',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  [Role.VIEWER]: {
    label: 'Viewer',
    description: 'Read-only access to organization resources',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
};

export function getRoleLabel(role: Role): string {
  return ROLE_INFO[role]?.label || role;
}

export function getRoleDescription(role: Role): string {
  return ROLE_INFO[role]?.description || '';
}
