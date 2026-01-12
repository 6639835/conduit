import { NextRequest, NextResponse } from 'next/server';
import { setupTOTP } from '@/lib/security/2fa';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/auth/middleware';

// POST /api/admin/2fa/setup - Generate TOTP secret and QR code for an API key
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const body = await request.json();
    const { apiKeyId } = body;

    if (!apiKeyId) {
      return NextResponse.json(
        { error: 'apiKeyId is required' },
        { status: 400 }
      );
    }

    // Verify API key exists
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId))
      .limit(1);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Generate TOTP setup
    const setup = await setupTOTP(
      apiKey.name || apiKey.keyPrefix,
      session.user.email ?? 'admin@conduit.local'
    );

    // Store the secret in the database
    await db
      .update(apiKeys)
      .set({ totpSecret: setup.secret })
      .where(eq(apiKeys.id, apiKeyId));

    return NextResponse.json({
      success: true,
      secret: setup.secret,
      qrCode: setup.qrCode,
      manualEntry: setup.manualEntryKey,
      message: 'Scan the QR code with your authenticator app',
    });
  } catch (error) {
    console.error('Failed to setup 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}
