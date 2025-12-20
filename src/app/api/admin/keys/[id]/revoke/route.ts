import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { revokeApiKey } from '@/lib/key-rotation';
import { logAudit } from '@/lib/audit';

// POST /api/admin/keys/[id]/revoke - Revoke an API key immediately
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      adminEmail: session.user.email,
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
