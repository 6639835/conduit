import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';
import { checkAuth, requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';

/**
 * GET /api/admin/notifications - Get notifications for current admin
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query conditions
    const conditions = [eq(notifications.adminId, session.user.id)];
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    // Fetch notifications
    const notificationList = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    // Get unread count
    const [{ count: unreadCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.adminId, session.user.id),
          eq(notifications.isRead, false)
        )
      );

    return NextResponse.json({
      success: true,
      data: notificationList,
      unreadCount: Number(unreadCount),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/notifications - Create a new notification
 * This is typically called internally by other parts of the system
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.SYSTEM_MANAGE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const { adminId, type, title, message, actionUrl, actionLabel, metadata } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, title, message' },
        { status: 400 }
      );
    }

    const [newNotification] = await db
      .insert(notifications)
      .values({
        adminId: adminId || null, // null means broadcast to all admins
        type,
        title,
        message,
        actionUrl,
        actionLabel,
        metadata,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newNotification,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/notifications - Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const body = await request.json();
    const { notificationIds, markAllRead } = body;

    if (markAllRead) {
      // Mark all notifications as read for the current user
      await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(notifications.adminId, session.user.id),
            eq(notifications.isRead, false)
          )
        );
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      for (const id of notificationIds) {
        await db
          .update(notifications)
          .set({ isRead: true, readAt: new Date() })
          .where(
            and(
              eq(notifications.id, id),
              eq(notifications.adminId, session.user.id)
            )
          );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Must provide notificationIds or markAllRead' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/notifications - Delete notifications
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const body = await request.json();
    const { notificationIds, deleteAll } = body;

    if (deleteAll) {
      // Delete all notifications for the current user
      await db
        .delete(notifications)
        .where(eq(notifications.adminId, session.user.id));
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Delete specific notifications
      for (const id of notificationIds) {
        await db
          .delete(notifications)
          .where(
            and(
              eq(notifications.id, id),
              eq(notifications.adminId, session.user.id)
            )
          );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Must provide notificationIds or deleteAll' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}
