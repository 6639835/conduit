import { NextRequest, NextResponse } from 'next/server';
import { verifyTOTP } from '@/lib/security/2fa';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';
import { checkAuth } from '@/lib/auth/middleware';

// POST /api/admin/2fa/verify - Verify TOTP code and enable 2FA for an API key
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const session = authResult.session;

    const body = await request.json();
    const { apiKeyId, code } = body;

    if (!apiKeyId || !code) {
      return NextResponse.json(
        { error: 'apiKeyId and code are required' },
        { status: 400 }
      );
    }

    // Get API key with TOTP secret
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

    if (!apiKey.totpSecret) {
      return NextResponse.json(
        { error: '2FA not set up for this key. Call /api/admin/2fa/setup first' },
        { status: 400 }
      );
    }

    // Verify the TOTP code
    const isValid = await verifyTOTP(apiKey.totpSecret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Enable 2FA for the key
    await db
      .update(apiKeys)
      .set({ totpEnabled: true })
      .where(eq(apiKeys.id, apiKeyId));

    // Log audit
    await logAudit({
      adminEmail: session.user.email ?? undefined,
      resourceType: 'api_key',
      resourceId: apiKeyId,
      action: '2fa_enabled',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: '2FA enabled successfully',
    });
  } catch (error) {
    console.error('Failed to verify 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to verify 2FA' },
      { status: 500 }
    );
  }
}
