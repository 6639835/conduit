import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission, Role } from '@/lib/auth/rbac';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  SSOProvider,
  validateSSOConfig,
  testSSOConnection,
  requiresEnterprise,
  getOAuthPreset,
  getSPMetadataUrl,
  getACSUrl,
  OAuthConfig,
} from '@/lib/auth/sso';
import { z } from 'zod';
import { encryptApiKey } from '@/lib/utils/crypto';

type SSOConfigRecord = Record<string, unknown>;

const updateSSOSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.nativeEnum(SSOProvider).optional(),
  config: z.record(z.string(), z.any()).optional(),
  testConnection: z.boolean().optional(),
});

/**
 * GET /api/admin/organizations/[id]/sso
 * Get SSO configuration for an organization
 *
 * Permission: ORG_UPDATE (can view own org) or SUPER_ADMIN (can view any org)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.ORG_READ);
    if (!authResult.authorized) return authResult.response;

    const { id: organizationId } = await params;

    // Check org access
    if (
      authResult.adminContext.role !== Role.SUPER_ADMIN &&
      authResult.adminContext.organizationId !== organizationId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have access to this organization',
        },
        { status: 403 }
      );
    }

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        plan: organizations.plan,
        ssoEnabled: organizations.ssoEnabled,
        ssoProvider: organizations.ssoProvider,
        ssoConfig: organizations.ssoConfig,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 404 }
      );
    }

    // Redact sensitive fields from config
    let sanitizedConfig: SSOConfigRecord | null = null;
    if (org.ssoConfig) {
      sanitizedConfig = { ...(org.ssoConfig as SSOConfigRecord) };
      // Remove sensitive fields
      if ('clientSecret' in sanitizedConfig) {
        sanitizedConfig.clientSecret = '***REDACTED***';
      }
      if ('certificate' in sanitizedConfig && typeof sanitizedConfig.certificate === 'string') {
        sanitizedConfig.certificate = sanitizedConfig.certificate.substring(0, 50) + '...';
      }
    }

    // Generate SAML metadata URLs if SAML is configured
    let samlMetadata = null;
    if (org.ssoProvider === SSOProvider.SAML) {
      samlMetadata = {
        spMetadataUrl: getSPMetadataUrl(org.slug),
        acsUrl: getACSUrl(org.slug),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        organizationId: org.id,
        organizationName: org.name,
        organizationSlug: org.slug,
        plan: org.plan,
        ssoEnabled: org.ssoEnabled,
        ssoProvider: org.ssoProvider,
        ssoConfig: sanitizedConfig,
        samlMetadata,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching SSO config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch SSO configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[id]/sso
 * Update SSO configuration for an organization
 *
 * Body:
 * - enabled: boolean - Enable/disable SSO
 * - provider: SSOProvider - SSO provider type
 * - config: object - Provider-specific configuration
 * - testConnection: boolean - Test the SSO connection before saving
 *
 * Permission: ORG_UPDATE (can update own org) or SUPER_ADMIN (can update any org)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.ORG_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { id: organizationId } = await params;

    // Check org access
    if (
      authResult.adminContext.role !== Role.SUPER_ADMIN &&
      authResult.adminContext.organizationId !== organizationId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have access to this organization',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateSSOSchema.safeParse(body);

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

    const { enabled, provider, config, testConnection } = validation.data;

    // Get organization
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        plan: organizations.plan,
        ssoEnabled: organizations.ssoEnabled,
        ssoProvider: organizations.ssoProvider,
        ssoConfig: organizations.ssoConfig,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 404 }
      );
    }

    // Check if provider requires enterprise plan
    if (provider && requiresEnterprise(provider) && org.plan !== 'enterprise') {
      return NextResponse.json(
        {
          success: false,
          error: `${provider} requires an enterprise plan`,
        },
        { status: 403 }
      );
    }

    // Prepare updates
    const updates: Partial<typeof organizations.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (enabled !== undefined) {
      updates.ssoEnabled = enabled;
    }

    if (provider !== undefined) {
      updates.ssoProvider = provider;

      // If switching provider, apply preset config
      const preset = getOAuthPreset(provider);
      if (preset && !config) {
        updates.ssoConfig = preset as SSOConfigRecord;
      }
    }

    if (config !== undefined) {
      const providerToUse = provider || org.ssoProvider;
      if (!providerToUse) {
        return NextResponse.json(
          {
            success: false,
            error: 'Provider must be specified when updating config',
          },
          { status: 400 }
        );
      }

      // Validate config
      const configValidation = validateSSOConfig(providerToUse as SSOProvider, config);
      if (!configValidation.valid || !configValidation.data) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid SSO configuration',
            details: configValidation.errors,
          },
          { status: 400 }
        );
      }

      // Encrypt client secret if OAuth
      let finalConfig = configValidation.data;
      if (
        providerToUse !== SSOProvider.SAML &&
        'clientSecret' in finalConfig &&
        finalConfig.clientSecret
      ) {
        const oauthConfig = finalConfig as OAuthConfig;
        finalConfig = {
          ...oauthConfig,
          clientSecret: await encryptApiKey(oauthConfig.clientSecret),
        };
      }

      updates.ssoConfig = finalConfig as SSOConfigRecord;

      // Test connection if requested
      if (testConnection) {
        const testResult = await testSSOConnection(providerToUse as SSOProvider, finalConfig);
        if (!testResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'SSO connection test failed',
              details: testResult.error,
            },
            { status: 400 }
          );
        }
      }
    }

    // Update organization
    await db.update(organizations).set(updates).where(eq(organizations.id, organizationId));

    // Fetch updated config
    const [updatedOrg] = await db
      .select({
        ssoEnabled: organizations.ssoEnabled,
        ssoProvider: organizations.ssoProvider,
        ssoConfig: organizations.ssoConfig,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    // Redact sensitive fields
    let sanitizedConfig: SSOConfigRecord | null = null;
    if (updatedOrg.ssoConfig) {
      sanitizedConfig = { ...(updatedOrg.ssoConfig as SSOConfigRecord) };
      if ('clientSecret' in sanitizedConfig) {
        sanitizedConfig.clientSecret = '***REDACTED***';
      }
      if ('certificate' in sanitizedConfig && typeof sanitizedConfig.certificate === 'string') {
        sanitizedConfig.certificate = sanitizedConfig.certificate.substring(0, 50) + '...';
      }
    }

    return NextResponse.json({
      success: true,
      message: 'SSO configuration updated successfully',
      data: {
        ssoEnabled: updatedOrg.ssoEnabled,
        ssoProvider: updatedOrg.ssoProvider,
        ssoConfig: sanitizedConfig,
      },
    });
  } catch (error) {
    console.error('[API] Error updating SSO config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update SSO configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[id]/sso
 * Disable and clear SSO configuration
 *
 * Permission: ORG_UPDATE or SUPER_ADMIN
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.ORG_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { id: organizationId } = await params;

    // Check org access
    if (
      authResult.adminContext.role !== Role.SUPER_ADMIN &&
      authResult.adminContext.organizationId !== organizationId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have access to this organization',
        },
        { status: 403 }
      );
    }

    // Disable SSO and clear config
    await db
      .update(organizations)
      .set({
        ssoEnabled: false,
        ssoProvider: null,
        ssoConfig: null,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    return NextResponse.json({
      success: true,
      message: 'SSO configuration disabled and removed',
    });
  } catch (error) {
    console.error('[API] Error deleting SSO config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete SSO configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
