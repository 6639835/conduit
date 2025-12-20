import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { rotateApiKey } from '@/lib/key-rotation';
import { logAudit } from '@/lib/audit';

// POST /api/admin/keys/[id]/rotate - Rotate an API key
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: params_id } = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { gracePeriodMs, notifyUsers } = body;

    const result = await rotateApiKey(
      params_id,
      gracePeriodMs || 3600000, // Default 1 hour
      notifyUsers !== false // Default true
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to rotate key' },
        { status: 400 }
      );
    }

    // Log audit
    await logAudit({
      adminEmail: session.user.email,
      resourceType: 'api_key',
      resourceId: params_id,
      action: 'rotate',
      changes: {
        gracePeriodMs,
        newKeyPrefix: result.newKeyPrefix,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      newKey: result.newKey,
      newKeyPrefix: result.newKeyPrefix,
      gracePeriodEnds: result.gracePeriodEnds,
      message: `Key rotated successfully. Old key will expire at ${result.gracePeriodEnds}`,
    });
  } catch (error) {
    console.error('Failed to rotate API key:', error);
    return NextResponse.json(
      { error: 'Failed to rotate API key' },
      { status: 500 }
    );
  }
}
