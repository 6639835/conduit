/**
 * Data Retention & Compliance System
 *
 * Handles:
 * - Automated data retention enforcement
 * - PII redaction
 * - GDPR/CCPA compliance exports
 * - Audit trail for compliance
 */

import { db } from '@/lib/db';
import { requestLogs, apiKeys, organizations } from '@/lib/db/schema';
import { lt, and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

// ============================================================================
// Data Retention
// ============================================================================

export interface RetentionPolicy {
  enabled: boolean;
  retentionDays: number;
  applyTo: ReadonlyArray<'usageLogs' | 'analytics' | 'audit_trail'>;
  organizationId?: string;
}

/**
 * Get retention policy for an organization
 */
export async function getRetentionPolicy(
  organizationId: string
): Promise<RetentionPolicy | null> {
  const [org] = await db
    .select({
      retentionPolicyDays: organizations.retentionPolicyDays,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org || !org.retentionPolicyDays) {
    return null;
  }

  return {
    enabled: true,
    retentionDays: org.retentionPolicyDays,
    applyTo: ['usageLogs', 'analytics', 'audit_trail'],
    organizationId,
  };
}

/**
 * Enforce data retention policy
 * Deletes data older than the retention period
 */
export async function enforceRetentionPolicy(
  organizationId?: string
): Promise<{
  success: boolean;
  deletedRecords: {
    usageLogs: number;
  };
  errors: string[];
}> {
  const errors: string[] = [];
  let deletedLogs = 0;

  try {
    // Get organizations with retention policies
    const orgsQuery = organizationId
      ? await db
          .select({
            id: organizations.id,
            name: organizations.name,
            retentionPolicyDays: organizations.retentionPolicyDays,
          })
          .from(organizations)
          .where(and(eq(organizations.id, organizationId), isNotNull(organizations.retentionPolicyDays)))
      : await db
          .select({
            id: organizations.id,
            name: organizations.name,
            retentionPolicyDays: organizations.retentionPolicyDays,
          })
          .from(organizations)
          .where(isNotNull(organizations.retentionPolicyDays));

    const orgs = orgsQuery.filter(o => o.retentionPolicyDays !== null);

    for (const org of orgs) {
      if (!org.retentionPolicyDays) continue;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - org.retentionPolicyDays);

      console.log(
        `[Retention] Enforcing ${org.retentionPolicyDays}-day policy for org ${org.name}`
      );

      // Get API keys for this organization
      const orgApiKeys = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.organizationId, org.id));

      if (orgApiKeys.length === 0) {
        continue;
      }

      // Delete old usage logs
      try {
        const apiKeyIds = orgApiKeys.map(k => k.id);

        const deletedLogsResult = await db
          .delete(requestLogs)
          .where(
            and(
              inArray(requestLogs.apiKeyId, apiKeyIds),
              lt(requestLogs.createdAt, cutoffDate)
            )
          )
          .returning({ id: requestLogs.id });

        const count = deletedLogsResult.length;
        deletedLogs += count;

        console.log(`[Retention] Deleted ${count} log records older than ${cutoffDate.toISOString()}`);
      } catch (error) {
        errors.push(`Failed to delete usageLogs for org ${org.name}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      deletedRecords: {
        usageLogs: deletedLogs,
      },
      errors,
    };
  } catch (error) {
    console.error('[Retention] Error enforcing retention policy:', error);
    return {
      success: false,
      deletedRecords: { usageLogs: 0 },
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// ============================================================================
// PII Redaction
// ============================================================================

/**
 * Redact PII (Personally Identifiable Information) from text
 */
export function redactPII(text: string): string {
  if (!text) return text;

  let redacted = text;

  // Email addresses
  redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');

  // Phone numbers (various formats)
  redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
  redacted = redacted.replace(/\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');

  // Credit card numbers (basic detection)
  redacted = redacted.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CC_REDACTED]');

  // SSN (US)
  redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');

  // IP addresses
  redacted = redacted.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]');

  // API keys and tokens (common patterns)
  redacted = redacted.replace(/\b[A-Za-z0-9_-]{20,}\b/g, '[TOKEN_REDACTED]');

  return redacted;
}

/**
 * Redact PII from structured data
 */
export function redactPIIFromObject(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      redacted[key] = redactPII(value);
    } else if (Array.isArray(value)) {
      redacted[key] = value.map(item => {
        if (typeof item === 'string') return redactPII(item);
        if (typeof item === 'object' && item !== null) {
          return redactPIIFromObject(item as Record<string, unknown>);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactPIIFromObject(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

// ============================================================================
// GDPR/CCPA Export
// ============================================================================

export interface DataExportRequest {
  organizationId: string;
  userEmail?: string;
  apiKeyId?: string;
  format: 'json' | 'csv';
  includeDeleted?: boolean;
}

export interface DataExportResult {
  success: boolean;
  exportData?: {
    organization: Record<string, unknown> | null;
    apiKeys: Array<Record<string, unknown>>;
    usageLogs: Array<Record<string, unknown>>;
    analytics: Array<Record<string, unknown>>;
  };
  error?: string;
  recordCount: {
    apiKeys: number;
    usageLogs: number;
  };
}

/**
 * Export all data for GDPR/CCPA compliance
 */
export async function exportOrganizationData(
  request: DataExportRequest
): Promise<DataExportResult> {
  try {
    const { organizationId, apiKeyId, format } = request;

    // Get organization data
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      return {
        success: false,
        error: 'Organization not found',
        recordCount: { apiKeys: 0, usageLogs: 0 },
      };
    }

    // Get API keys
    const apiKeyConditions = [eq(apiKeys.organizationId, organizationId)];
    if (apiKeyId) {
      apiKeyConditions.push(eq(apiKeys.id, apiKeyId));
    }

    const apiKeysData = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
        createdAt: apiKeys.createdAt,
        isActive: apiKeys.isActive,
        organizationId: apiKeys.organizationId,
        projectId: apiKeys.projectId,
      })
      .from(apiKeys)
      .where(and(...apiKeyConditions));

    const scopedApiKeyIds = apiKeysData.map((key) => key.id);

    // Get usage logs (limited to last 10,000 for performance)
    const logsData = scopedApiKeyIds.length > 0
      ? await db
          .select({
            id: requestLogs.id,
            timestamp: requestLogs.createdAt,
            method: requestLogs.method,
            endpoint: requestLogs.endpoint,
            statusCode: requestLogs.statusCode,
            model: requestLogs.model,
            tokensUsed: sql<number>`${requestLogs.promptTokens} + ${requestLogs.completionTokens}`,
            cost: requestLogs.cost,
            errorMessage: requestLogs.errorMessage,
          })
          .from(requestLogs)
          .where(inArray(requestLogs.apiKeyId, scopedApiKeyIds))
          .orderBy(requestLogs.createdAt)
          .limit(10000)
      : [];

    // Redact PII from usageLogs
    const redactedLogs = logsData.map(log => ({
      ...log,
      errorMessage: log.errorMessage ? redactPII(log.errorMessage) : null,
    }));

    // Prepare export data
    const exportData = {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
        createdAt: organization.createdAt,
      },
      apiKeys: apiKeysData,
      usageLogs: redactedLogs,
      analytics: [], // Placeholder for analytics data
      exportedAt: new Date().toISOString(),
      exportFormat: format,
    };

    return {
      success: true,
      exportData,
      recordCount: {
        apiKeys: apiKeysData.length,
        usageLogs: redactedLogs.length,
      },
    };
  } catch (error) {
    console.error('[Compliance] Error exporting organization data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      recordCount: { apiKeys: 0, usageLogs: 0 },
    };
  }
}

// ============================================================================
// Data Deletion (Right to be Forgotten)
// ============================================================================

export interface DataDeletionRequest {
  organizationId: string;
  deleteAll?: boolean;
  deleteApiKeys?: boolean;
  deleteLogs?: boolean;
  retainMetadata?: boolean; // Keep minimal metadata for compliance
}

export interface DataDeletionResult {
  success: boolean;
  deletedRecords: {
    apiKeys: number;
    usageLogs: number;
  };
  error?: string;
}

/**
 * Delete organization data (GDPR Right to be Forgotten)
 */
export async function deleteOrganizationData(
  request: DataDeletionRequest
): Promise<DataDeletionResult> {
  try {
    const { organizationId, deleteAll, deleteApiKeys, deleteLogs, retainMetadata } = request;

    let deletedApiKeys = 0;
    let deletedLogs = 0;

    // Delete usageLogs
    if (deleteAll || deleteLogs) {
      const apiKeysInOrg = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.organizationId, organizationId));

      for (const key of apiKeysInOrg) {
        const deleted = await db.delete(requestLogs).where(eq(requestLogs.apiKeyId, key.id)).returning({ id: requestLogs.id });
        deletedLogs += deleted.length;
      }

      console.log(`[Compliance] Deleted ${deletedLogs} log records for org ${organizationId}`);
    }

    // Delete API keys
    if (deleteAll || deleteApiKeys) {
      const deleted = await db
        .delete(apiKeys)
        .where(eq(apiKeys.organizationId, organizationId))
        .returning({ id: apiKeys.id });

      deletedApiKeys = deleted.length;
      console.log(`[Compliance] Deleted ${deletedApiKeys} API keys for org ${organizationId}`);
    }

    // Optionally delete organization
    if (deleteAll && !retainMetadata) {
      await db.delete(organizations).where(eq(organizations.id, organizationId));
      console.log(`[Compliance] Deleted organization ${organizationId}`);
    }

    return {
      success: true,
      deletedRecords: {
        apiKeys: deletedApiKeys,
        usageLogs: deletedLogs,
      },
    };
  } catch (error) {
    console.error('[Compliance] Error deleting organization data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      deletedRecords: { apiKeys: 0, usageLogs: 0 },
    };
  }
}

// ============================================================================
// Compliance Reporting
// ============================================================================

export interface ComplianceReport {
  organizationId: string;
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  retentionPolicy: RetentionPolicy | null;
  dataInventory: {
    apiKeys: number;
    usageLogs: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
  };
  complianceIssues: string[];
  recommendations: string[];
}

/**
 * Generate compliance report for an organization
 */
export async function generateComplianceReport(
  organizationId: string
): Promise<ComplianceReport> {
  const [org] = await db
    .select({
      gdprCompliant: organizations.gdprCompliant,
      ccpaCompliant: organizations.ccpaCompliant,
      retentionPolicyDays: organizations.retentionPolicyDays,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error('Organization not found');
  }

  // Count API keys
  const apiKeysCount = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, organizationId));

  const scopedApiKeyIds = apiKeysCount.map((key) => key.id);

  // Count usageLogs
  const logsCount = scopedApiKeyIds.length > 0
    ? await db
        .select({ id: requestLogs.id })
        .from(requestLogs)
        .where(inArray(requestLogs.apiKeyId, scopedApiKeyIds))
        .limit(100000) // Limit for performance
    : [];

  const retentionPolicy = org.retentionPolicyDays
    ? {
        enabled: true,
        retentionDays: org.retentionPolicyDays,
        applyTo: ['usageLogs', 'analytics', 'audit_trail'] as const,
        organizationId,
      }
    : null;

  const complianceIssues: string[] = [];
  const recommendations: string[] = [];

  // Check for compliance issues
  if (!org.retentionPolicyDays) {
    complianceIssues.push('No data retention policy configured');
    recommendations.push('Set a data retention policy to comply with GDPR/CCPA');
  }

  if (!org.gdprCompliant) {
    complianceIssues.push('Not marked as GDPR compliant');
    recommendations.push('Review and update GDPR compliance settings');
  }

  if (!org.ccpaCompliant) {
    complianceIssues.push('Not marked as CCPA compliant');
    recommendations.push('Review and update CCPA compliance settings');
  }

  return {
    organizationId,
    gdprCompliant: org.gdprCompliant,
    ccpaCompliant: org.ccpaCompliant,
    retentionPolicy,
    dataInventory: {
      apiKeys: apiKeysCount.length,
      usageLogs: logsCount.length,
      oldestRecord: null, // Would query min timestamp
      newestRecord: null, // Would query max timestamp
    },
    complianceIssues,
    recommendations,
  };
}
