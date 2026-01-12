import { NextRequest, NextResponse } from 'next/server';
import { auth } from './index';

/**
 * Middleware to check if user is authenticated as an admin
 * Returns the session if authenticated, or an error response if not
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
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
