import { db } from './db';
import { auditLogs } from './db/schema';

export type ResourceType =
  | 'api_key'
  | 'provider'
  | 'admin'
  | 'organization'
  | 'project'
  | 'settings';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'rotate'
  | 'revoke'
  | 'activate'
  | 'deactivate'
  | 'login'
  | 'logout'
  | 'login_failed'
  | '2fa_enabled'
  | '2fa_disabled';

interface AuditLogParams {
  adminId?: string;
  adminEmail?: string;
  resourceType: ResourceType;
  resourceId?: string;
  action: AuditAction;
  changes?: Record<string, unknown> | {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates an audit log entry
 * @param params - Audit log parameters
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      action: params.action,
      changes: params.changes,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: params.metadata,
      timestamp: new Date(),
    });
  } catch (error) {
    // Don't throw errors for audit logging failures - just log them
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Logs an API key creation
 */
export async function logApiKeyCreation(
  apiKeyId: string,
  adminId: string,
  adminEmail: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAudit({
    adminId,
    adminEmail,
    resourceType: 'api_key',
    resourceId: apiKeyId,
    action: 'create',
    ipAddress,
    userAgent,
  });
}

/**
 * Logs an API key update
 */
export async function logApiKeyUpdate(
  apiKeyId: string,
  adminId: string,
  adminEmail: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAudit({
    adminId,
    adminEmail,
    resourceType: 'api_key',
    resourceId: apiKeyId,
    action: 'update',
    changes: { before, after },
    ipAddress,
    userAgent,
  });
}

/**
 * Logs an API key rotation
 */
export async function logApiKeyRotation(
  apiKeyId: string,
  adminId: string,
  adminEmail: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAudit({
    adminId,
    adminEmail,
    resourceType: 'api_key',
    resourceId: apiKeyId,
    action: 'rotate',
    ipAddress,
    userAgent,
  });
}

/**
 * Logs an API key revocation
 */
export async function logApiKeyRevocation(
  apiKeyId: string,
  adminId: string,
  adminEmail: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAudit({
    adminId,
    adminEmail,
    resourceType: 'api_key',
    resourceId: apiKeyId,
    action: 'revoke',
    ipAddress,
    userAgent,
  });
}

/**
 * Logs a login attempt
 */
export async function logLogin(
  adminId: string,
  adminEmail: string,
  success: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAudit({
    adminId: success ? adminId : undefined,
    adminEmail,
    resourceType: 'admin',
    resourceId: adminId,
    action: success ? 'login' : 'login_failed',
    ipAddress,
    userAgent,
  });
}

/**
 * Logs 2FA enablement/disablement
 */
export async function log2FAChange(
  adminId: string,
  adminEmail: string,
  enabled: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAudit({
    adminId,
    adminEmail,
    resourceType: 'admin',
    resourceId: adminId,
    action: enabled ? '2fa_enabled' : '2fa_disabled',
    ipAddress,
    userAgent,
  });
}
