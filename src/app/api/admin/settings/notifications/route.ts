import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { admins } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/auth/middleware';
import { z } from 'zod';

const updateNotificationSettingsSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
  notificationEmail: z.string().email().optional().nullable(),
  slackWebhookUrl: z.string().url().optional().nullable(),
  discordWebhookUrl: z.string().url().optional().nullable(),
  notificationPreferences: z.object({
    quotaWarnings: z.boolean().optional(),
    keyExpirations: z.boolean().optional(),
    errorSpikes: z.boolean().optional(),
    providerHealth: z.boolean().optional(),
    spendLimits: z.boolean().optional(),
  }).optional(),
});

interface NotificationSettingsResponse {
  success: boolean;
  settings?: {
    emailNotificationsEnabled: boolean;
    notificationEmail: string | null;
    slackWebhookUrl: string | null;
    discordWebhookUrl: string | null;
    notificationPreferences: {
      quotaWarnings: boolean;
      keyExpirations: boolean;
      errorSpikes: boolean;
      providerHealth: boolean;
      spendLimits: boolean;
    };
  };
  error?: string;
}

/**
 * GET /api/admin/settings/notifications - Get current notification settings
 * Requires authentication
 */
export async function GET(_request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const [admin] = await db
      .select({
        id: admins.id,
        permissions: admins.permissions,
      })
      .from(admins)
      .where(eq(admins.id, session.user.id))
      .limit(1);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found',
        } as NotificationSettingsResponse,
        { status: 404 }
      );
    }

    // Extract notification settings from permissions JSONB
    const permissions = admin.permissions as Record<string, unknown> || {};
    const settings = (permissions.notificationSettings || {}) as Record<string, unknown>;

    return NextResponse.json(
      {
        success: true,
        settings: {
          emailNotificationsEnabled: Boolean(settings.emailNotificationsEnabled),
          notificationEmail: (settings.notificationEmail as string) || null,
          slackWebhookUrl: (settings.slackWebhookUrl as string) || null,
          discordWebhookUrl: (settings.discordWebhookUrl as string) || null,
          notificationPreferences: {
            quotaWarnings: Boolean((settings.notificationPreferences as Record<string, unknown>)?.quotaWarnings ?? true),
            keyExpirations: Boolean((settings.notificationPreferences as Record<string, unknown>)?.keyExpirations ?? true),
            errorSpikes: Boolean((settings.notificationPreferences as Record<string, unknown>)?.errorSpikes ?? true),
            providerHealth: Boolean((settings.notificationPreferences as Record<string, unknown>)?.providerHealth ?? true),
            spendLimits: Boolean((settings.notificationPreferences as Record<string, unknown>)?.spendLimits ?? true),
          },
        },
      } as NotificationSettingsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get notification settings',
      } as NotificationSettingsResponse,
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/settings/notifications - Update notification settings
 * Requires authentication
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const body = await request.json();
    const validationResult = updateNotificationSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as NotificationSettingsResponse,
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Get current admin
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, session.user.id))
      .limit(1);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found',
        } as NotificationSettingsResponse,
        { status: 404 }
      );
    }

    // Merge with existing settings
    const currentPermissions = (admin.permissions || {}) as Record<string, unknown>;
    const currentSettings = (currentPermissions.notificationSettings || {}) as Record<string, unknown>;

    const updatedSettings = {
      ...currentSettings,
      ...(data.emailNotificationsEnabled !== undefined && { emailNotificationsEnabled: data.emailNotificationsEnabled }),
      ...(data.notificationEmail !== undefined && { notificationEmail: data.notificationEmail }),
      ...(data.slackWebhookUrl !== undefined && { slackWebhookUrl: data.slackWebhookUrl }),
      ...(data.discordWebhookUrl !== undefined && { discordWebhookUrl: data.discordWebhookUrl }),
      ...(data.notificationPreferences && {
        notificationPreferences: {
          ...(currentSettings.notificationPreferences as Record<string, unknown> || {}),
          ...data.notificationPreferences,
        },
      }),
    };

    // Update admin permissions
    await db
      .update(admins)
      .set({
        permissions: {
          ...currentPermissions,
          notificationSettings: updatedSettings,
        },
        updatedAt: new Date(),
      })
      .where(eq(admins.id, session.user.id));

    return NextResponse.json(
      {
        success: true,
        settings: {
          emailNotificationsEnabled: Boolean(updatedSettings.emailNotificationsEnabled),
          notificationEmail: (updatedSettings.notificationEmail as string) || null,
          slackWebhookUrl: (updatedSettings.slackWebhookUrl as string) || null,
          discordWebhookUrl: (updatedSettings.discordWebhookUrl as string) || null,
          notificationPreferences: updatedSettings.notificationPreferences as {
            quotaWarnings: boolean;
            keyExpirations: boolean;
            errorSpikes: boolean;
            providerHealth: boolean;
            spendLimits: boolean;
          },
        },
      } as NotificationSettingsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update notification settings',
      } as NotificationSettingsResponse,
      { status: 500 }
    );
  }
}
