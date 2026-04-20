import { NextRequest, NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/key-rotation';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { canAccessApiKey } from '@/lib/auth/api-key-access';

// POST /api/admin/keys/[id]/revoke - Revoke an API key immediately
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const authResult = await requirePermission(Permission.API_KEY_DELETE);
    if (!authResult.authorized) return authResult.response;

    if (!(await canAccessApiKey(id, authResult.adminContext))) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const body = await request.json();
    const { reason } = body;

    const result = await revokeApiKey(id, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to revoke key' },
        { status: 400 }
      );
    }

    // Log audit
    await logAudit({
      adminId: authResult.adminContext.id,
      resourceType: 'api_key',
      resourceId: id,
      action: 'revoke',
      changes: { reason },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Key revoked successfully',
    });
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
