import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { apiKeyAccessCondition } from '@/lib/auth/api-key-access';

// POST /api/admin/2fa/disable - Disable 2FA for an API key
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.API_KEY_UPDATE);
    if (!authResult.authorized) return authResult.response;

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
      .where(apiKeyAccessCondition(apiKeyId, authResult.adminContext))
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
      .where(apiKeyAccessCondition(apiKeyId, authResult.adminContext));

    // Log audit
    await logAudit({
      adminId: authResult.adminContext.id,
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
