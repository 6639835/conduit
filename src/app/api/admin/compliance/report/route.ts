import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireOrganizationAccess } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { generateComplianceReport } from '@/lib/compliance/retention';

/**
 * GET /api/admin/compliance/report
 * Generate compliance report for an organization
 *
 * Query params:
 * - organizationId: UUID of organization
 *
 * Permission: COMPLIANCE_MANAGE
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.COMPLIANCE_MANAGE);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'organizationId is required',
        },
        { status: 400 }
      );
    }

    // Check organization access
    const orgAccessResult = await requireOrganizationAccess(organizationId);
    if (!orgAccessResult.authorized) return orgAccessResult.response;

    console.log(`[Compliance] Generating report for organization ${organizationId}`);

    // Generate report
    const report = await generateComplianceReport(organizationId);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[API] Error generating compliance report:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate compliance report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
