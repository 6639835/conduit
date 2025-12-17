import { db } from '@/lib/db';
import { notifications, admins } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface CreateNotificationParams {
  adminId?: string | null; // null for broadcast to all
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for an admin user or broadcast to all admins
 */
export async function createNotification(params: CreateNotificationParams) {
  const { adminId, type, title, message, actionUrl, actionLabel, metadata } = params;

  // If adminId is null, create notification for all active admins
  if (adminId === null || adminId === undefined) {
    const allAdmins = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.isActive, true));

    if (allAdmins.length === 0) {
      console.warn('No active admins found for broadcast notification');
      return null;
    }

    // Create notification for each admin
    const createdNotifications = await db
      .insert(notifications)
      .values(
        allAdmins.map(admin => ({
          adminId: admin.id,
          type,
          title,
          message,
          actionUrl,
          actionLabel,
          metadata,
        }))
      )
      .returning();

    return createdNotifications[0]; // Return first for consistency
  }

  // Create notification for specific admin
  const [notification] = await db
    .insert(notifications)
    .values({
      adminId,
      type,
      title,
      message,
      actionUrl,
      actionLabel,
      metadata,
    })
    .returning();

  return notification;
}

/**
 * Create notifications for system events
 */
export const SystemNotifications = {
  /**
   * Notify when an API key reaches quota threshold
   */
  async apiKeyQuotaWarning(adminId: string, keyPrefix: string, usagePercent: number) {
    return createNotification({
      adminId,
      type: 'warning',
      title: 'API Key Quota Warning',
      message: `API key ${keyPrefix}... has reached ${usagePercent}% of its daily quota.`,
      actionUrl: '/admin/keys',
      actionLabel: 'View API Keys',
      metadata: { keyPrefix, usagePercent },
    });
  },

  /**
   * Notify when a provider health check fails
   */
  async providerUnhealthy(adminId: string | null, providerName: string, providerId: string) {
    return createNotification({
      adminId,
      type: 'error',
      title: 'Provider Health Check Failed',
      message: `Provider "${providerName}" is not responding. API requests may be affected.`,
      actionUrl: '/admin/providers',
      actionLabel: 'View Providers',
      metadata: { providerName, providerId },
    });
  },

  /**
   * Notify when a provider is restored to healthy status
   */
  async providerRestored(adminId: string | null, providerName: string, providerId: string) {
    return createNotification({
      adminId,
      type: 'success',
      title: 'Provider Restored',
      message: `Provider "${providerName}" is now healthy and operational.`,
      actionUrl: '/admin/providers',
      actionLabel: 'View Providers',
      metadata: { providerName, providerId },
    });
  },

  /**
   * Notify when there's a spike in error rates
   */
  async errorRateSpike(adminId: string | null, errorRate: number, timeWindow: string) {
    return createNotification({
      adminId,
      type: 'error',
      title: 'Error Rate Spike Detected',
      message: `Error rate has increased to ${errorRate}% in the last ${timeWindow}.`,
      actionUrl: '/admin/logs',
      actionLabel: 'View Logs',
      metadata: { errorRate, timeWindow },
    });
  },

  /**
   * Notify when a new API key is created
   */
  async apiKeyCreated(adminId: string, keyName: string | null, keyPrefix: string) {
    return createNotification({
      adminId,
      type: 'info',
      title: 'New API Key Created',
      message: `API key "${keyName || keyPrefix}..." has been created.`,
      actionUrl: '/admin/keys',
      actionLabel: 'View API Keys',
      metadata: { keyName, keyPrefix },
    });
  },

  /**
   * Notify when monthly spend limit is reached
   */
  async spendLimitReached(adminId: string, keyPrefix: string, limit: number) {
    return createNotification({
      adminId,
      type: 'warning',
      title: 'Monthly Spend Limit Reached',
      message: `API key ${keyPrefix}... has reached its monthly spend limit of $${(limit / 100).toFixed(2)}.`,
      actionUrl: '/admin/keys',
      actionLabel: 'View API Keys',
      metadata: { keyPrefix, limit },
    });
  },
};
