import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { admins, apiKeys } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

interface UpdateUserRequest {
  email?: string;
  name?: string;
  password?: string;
}

interface UpdateUserResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    updatedAt: string;
  };
}

interface DeleteUserResponse {
  success: boolean;
  error?: string;
}

interface GetUserResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: 'admin' | 'user';
    isActive: boolean;
    createdAt: string;
    lastActiveAt: string | null;
    apiKeyCount: number;
  };
}

/**
 * GET /api/admin/users/[id] - Get a specific user
 * TODO: Add authentication middleware (NextAuth) in Phase 7
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [user] = await db
      .select({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        createdAt: admins.createdAt,
        updatedAt: admins.updatedAt,
      })
      .from(admins)
      .where(eq(admins.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        } as GetUserResponse,
        { status: 404 }
      );
    }

    // Get API key count
    const keyCount = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(apiKeys)
      .where(eq(apiKeys.createdBy, user.id))
      .execute();

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: 'admin' as const,
          isActive: true,
          createdAt: user.createdAt.toISOString(),
          lastActiveAt: user.updatedAt.toISOString(),
          apiKeyCount: keyCount[0]?.count || 0,
        },
      } as GetUserResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user',
      } as GetUserResponse,
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id] - Update a user
 * TODO: Add authentication middleware (NextAuth) in Phase 7
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateUserRequest = await request.json();

    // Build update object
    const updates: Partial<typeof admins.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (body.email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid email format',
          } as UpdateUserResponse,
          { status: 400 }
        );
      }

      // Check if email is already taken by another user
      const existingUser = await db
        .select()
        .from(admins)
        .where(eq(admins.email, body.email))
        .limit(1);

      if (existingUser.length > 0 && existingUser[0].id !== id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email already taken',
          } as UpdateUserResponse,
          { status: 409 }
        );
      }

      updates.email = body.email;
    }

    if (body.name !== undefined) {
      updates.name = body.name;
    }

    if (body.password !== undefined && body.password.length > 0) {
      updates.passwordHash = await bcrypt.hash(body.password, 10);
    }

    // Update in database
    const [updatedUser] = await db
      .update(admins)
      .set(updates)
      .where(eq(admins.id, id))
      .returning();

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        } as UpdateUserResponse,
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          updatedAt: updatedUser.updatedAt.toISOString(),
        },
      } as UpdateUserResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update user',
      } as UpdateUserResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id] - Delete a user
 * TODO: Add authentication middleware (NextAuth) in Phase 7
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if user has any API keys
    const keyCount = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(apiKeys)
      .where(eq(apiKeys.createdBy, id))
      .execute();

    if (keyCount[0]?.count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete user with existing API keys. Revoke all keys first.',
        } as DeleteUserResponse,
        { status: 400 }
      );
    }

    // Delete the user
    const [deletedUser] = await db
      .delete(admins)
      .where(eq(admins.id, id))
      .returning();

    if (!deletedUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        } as DeleteUserResponse,
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
      } as DeleteUserResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete user',
      } as DeleteUserResponse,
      { status: 500 }
    );
  }
}
