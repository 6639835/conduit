import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// POST /api/admin/2fa/disable - Disable 2FA for an API key
// TODO: 2FA for API keys is not yet implemented in the schema
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      error: '2FA for API keys is not yet implemented',
    }, { status: 501 });
  } catch (error) {
    console.error('Failed to disable 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
