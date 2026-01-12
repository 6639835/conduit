import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';

// POST /api/admin/2fa/disable - Disable 2FA for an API key
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (!apiKey.totpEnabled) {
      return NextResponse.json(
        { error: '2FA is not enabled for this API key' },
        { status: 400 }
      );
    }

    // Disable 2FA and clear the secret
    await db
      .update(apiKeys)
      .set({
        totpEnabled: false,
        totpSecret: null,
      })
      .where(eq(apiKeys.id, apiKeyId));

    // Log audit
    await logAudit({
      adminEmail: session.user.email,
      resourceType: 'api_key',
      resourceId: apiKeyId,
      action: '2fa_disabled',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: '2FA disabled successfully',
    });
  } catch (error) {
    console.error('Failed to disable 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
