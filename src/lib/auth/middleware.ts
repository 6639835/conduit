import { NextRequest, NextResponse } from 'next/server';
import { auth } from './index';
import { db } from '@/lib/db';
import { admins } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Middleware to check if user is authenticated as an admin
 * Returns the session if authenticated, or an error response if not
 */
export async function requireAuth() {
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

  return {
    authenticated: true,
    session,
  };
}

/**
 * Helper function to check authentication and return early if not authenticated
 * Usage:
 * const authResult = await checkAuth();
 * if (authResult.error) return authResult.error;
 * // Now you can use authResult.session
 */
export async function checkAuth() {
  const result = await requireAuth();

  if (!result.authenticated) {
    return {
      error: result.response,
    };
  }

  return {
    session: result.session,
  };
}
