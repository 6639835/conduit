import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireOrganizationAccess } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { exportOrganizationData } from '@/lib/compliance/retention';
import { z } from 'zod';

const exportRequestSchema = z.object({
  organizationId: z.string().uuid(),
  userEmail: z.string().email().optional(),
  apiKeyId: z.string().uuid().optional(),
  format: z.enum(['json', 'csv']).default('json'),
  includeDeleted: z.boolean().default(false),
});

/**
 * POST /api/admin/compliance/export
 * Export organization data for GDPR/CCPA compliance
 *
 * Body:
 * - organizationId: UUID of organization
 * - userEmail: Filter by user email (optional)
 * - apiKeyId: Filter by API key (optional)
 * - format: 'json' or 'csv'
 * - includeDeleted: Include soft-deleted records
 *
 * Permission: COMPLIANCE_MANAGE
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.COMPLIANCE_MANAGE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validation = exportRequestSchema.safeParse(body);

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

    const { organizationId, format } = validation.data;

    // Check organization access
    const orgAccessResult = await requireOrganizationAccess(organizationId);
    if (!orgAccessResult.authorized) return orgAccessResult.response;

    console.log(`[Compliance] Exporting data for organization ${organizationId}`);

    // Export data
    const exportResult = await exportOrganizationData(validation.data);

    if (!exportResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: exportResult.error || 'Failed to export data',
        },
        { status: 500 }
      );
    }

    // Return export data
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: exportResult.exportData,
        recordCount: exportResult.recordCount,
      });
    } else {
      // CSV export (simplified - would need proper CSV formatting in production)
      const csvData = JSON.stringify(exportResult.exportData);
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="data-export-${organizationId}.csv"`,
        },
      });
    }
  } catch (error) {
    console.error('[API] Error exporting compliance data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export compliance data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
