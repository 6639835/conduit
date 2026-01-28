import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { admins } from '@/lib/db/schema';
import { apiKeys } from '@/lib/db/schema';
import { desc, eq, sql, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission, Role } from '@/lib/auth/rbac';

interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role?: 'admin' | 'user';
}

interface CreateUserResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
  };
}

interface ListUsersResponse {
  success: boolean;
  error?: string;
  users?: Array<{
    id: string;
    email: string;
    name: string | null;
    role: 'admin' | 'user';
    isActive: boolean;
    createdAt: string;
    lastActiveAt: string | null;
    apiKeyCount: number;
  }>;
}

/**
 * POST /api/admin/users - Create a new admin user
 */
export async function POST(request: NextRequest) {
  // Check permission
  const authResult = await requirePermission(Permission.ADMIN_CREATE);
  if (!authResult.authorized) return authResult.response;

  try {
    const body: CreateUserRequest = await request.json();

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: email and password',
        } as CreateUserResponse,
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email format',
        } as CreateUserResponse,
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(admins)
      .where(eq(admins.email, body.email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'User with this email already exists',
        } as CreateUserResponse,
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Insert into database
    const [newUser] = await db
      .insert(admins)
      .values({
        email: body.email,
        name: body.name || null,
        passwordHash,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          createdAt: newUser.createdAt.toISOString(),
        },
      } as CreateUserResponse,
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create user',
      } as CreateUserResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/users - List all admin users with roles
 * Query params:
 * - organizationId: Filter by organization (optional)
 * Permission: ADMIN_READ
 */
export async function GET(request: NextRequest) {
  // Check permission
  const authResult = await requirePermission(Permission.ADMIN_READ);
  if (!authResult.authorized) return authResult.response;

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  try {
    // Build query conditions
    const conditions = [];

    // Org admins can only see users in their organization
    if (authResult.adminContext.role === Role.ORG_ADMIN) {
      if (authResult.adminContext.organizationId) {
        conditions.push(eq(admins.organizationId, authResult.adminContext.organizationId));
      } else {
        // Org admin without organization can't see any users
        return NextResponse.json({
          success: true,
          users: [],
          total: 0,
          canManageUsers: false,
        });
      }
    } else if (organizationId) {
      // Super admins can filter by organization
      conditions.push(eq(admins.organizationId, organizationId));
    }

    // Get all users with their API key counts
    const users = await db
      .select({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        role: admins.role,
        organizationId: admins.organizationId,
        permissions: admins.permissions,
        isActive: admins.isActive,
        createdAt: admins.createdAt,
        updatedAt: admins.updatedAt,
      })
      .from(admins)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(admins.createdAt));

    // Get API key counts for each user
    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        const keyCount = await db
          .select({
            count: sql<number>`count(*)`,
          })
          .from(apiKeys)
          .where(eq(apiKeys.createdBy, user.id))
          .execute();

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          permissions: user.permissions,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          lastActiveAt: user.updatedAt.toISOString(),
          apiKeyCount: keyCount[0]?.count || 0,
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        users: usersWithCounts,
        total: usersWithCounts.length,
        canManageUsers: authResult.adminContext.role !== Role.VIEWER,
        currentAdminRole: authResult.adminContext.role,
      } as ListUsersResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list users',
      } as ListUsersResponse,
      { status: 500 }
    );
  }
}
