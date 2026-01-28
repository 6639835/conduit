/**
 * PII Detection API
 * Detect and redact personally identifiable information
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { detectPII } from '@/lib/security/behavioral-analysis';
import { z } from 'zod';

const piiDetectionSchema = z.object({
  content: z.string(),
});

/**
 * POST /api/admin/security/pii
 * Detect PII in content
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.ANALYTICS_VIEW);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validation = piiDetectionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const result = detectPII(validation.data.content);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Security] Error detecting PII:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to detect PII',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
