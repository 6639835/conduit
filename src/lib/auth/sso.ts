/**
 * Single Sign-On (SSO) and SAML Authentication System
 *
 * Provides SSO integration for organizations with support for:
 * - SAML 2.0
 * - OAuth 2.0 (Google, GitHub, Azure AD)
 */

import { z } from 'zod';
import { getAppBaseUrl } from '@/lib/env';

// ============================================================================
// SSO Provider Types
// ============================================================================

export enum SSOProvider {
  SAML = 'saml',
  OAUTH_GOOGLE = 'oauth-google',
  OAUTH_GITHUB = 'oauth-github',
  OAUTH_AZURE = 'oauth-azure',
}

// ============================================================================
// SAML Configuration
// ============================================================================

export const SAMLConfigSchema = z.object({
  // Identity Provider (IdP) Configuration
  entityId: z.string().min(1, 'Entity ID is required'),
  ssoUrl: z.string().url('Invalid SSO URL'),
  sloUrl: z.string().url('Invalid SLO URL').optional(),
  certificate: z.string().min(1, 'Certificate is required'),

  // Service Provider (SP) Configuration
  spEntityId: z.string().optional(),
  spAcsUrl: z.string().url().optional(),

  // Security Settings
  signRequests: z.boolean().default(true),
  signatureAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).default('sha256'),
  encryptAssertions: z.boolean().default(false),
  encryptionAlgorithm: z.enum(['aes128-cbc', 'aes256-cbc', 'tripledes-cbc']).default('aes256-cbc'),

  // Attribute Mapping
  attributeMapping: z.object({
    email: z.string().default('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'),
    firstName: z.string().default('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'),
    lastName: z.string().default('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'),
    displayName: z.string().default('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'),
  }).optional(),

  // Advanced
  wantAssertionsSigned: z.boolean().default(true),
  wantMessagesSigned: z.boolean().default(true),
  allowUnencryptedAssertion: z.boolean().default(false),
});

export type SAMLConfig = z.infer<typeof SAMLConfigSchema>;

// ============================================================================
// OAuth Configuration
// ============================================================================

export const OAuthConfigSchema = z.object({
  // OAuth Application Credentials
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'), // Will be encrypted before storage

  // OAuth Endpoints
  authorizeUrl: z.string().url('Invalid authorization URL'),
  tokenUrl: z.string().url('Invalid token URL'),
  userInfoUrl: z.string().url('Invalid user info URL').optional(),

  // Scopes
  scopes: z.array(z.string()).default(['openid', 'email', 'profile']),

  // Token Settings
  tokenEndpointAuthMethod: z.enum(['client_secret_basic', 'client_secret_post']).default('client_secret_post'),

  // User Mapping
  userMapping: z.object({
    email: z.string().default('email'),
    firstName: z.string().default('given_name'),
    lastName: z.string().default('family_name'),
    displayName: z.string().default('name'),
  }).optional(),
});

export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;

// ============================================================================
// SSO Configuration Union Type
// ============================================================================

export type SSOConfig = SAMLConfig | OAuthConfig;

// ============================================================================
// Preset Configurations
// ============================================================================

export const OAuthPresets: Record<string, Partial<OAuthConfig>> = {
  [SSOProvider.OAUTH_GOOGLE]: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    userMapping: {
      email: 'email',
      firstName: 'given_name',
      lastName: 'family_name',
      displayName: 'name',
    },
  },
  [SSOProvider.OAUTH_GITHUB]: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    userMapping: {
      email: 'email',
      firstName: 'name', // GitHub doesn't separate first/last
      lastName: '',
      displayName: 'name',
    },
  },
  [SSOProvider.OAUTH_AZURE]: {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'email', 'profile'],
    userMapping: {
      email: 'mail',
      firstName: 'givenName',
      lastName: 'surname',
      displayName: 'displayName',
    },
  },
};

// ============================================================================
// SSO Validation
// ============================================================================

/**
 * Validate SSO configuration based on provider type
 */
export function validateSSOConfig(provider: SSOProvider, config: unknown): {
  valid: boolean;
  errors?: string[];
  data?: SSOConfig;
} {
  try {
    if (provider === SSOProvider.SAML) {
      const result = SAMLConfigSchema.safeParse(config);
      if (!result.success) {
        return {
          valid: false,
          errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: true, data: result.data };
    } else {
      const result = OAuthConfigSchema.safeParse(config);
      if (!result.success) {
        return {
          valid: false,
          errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: true, data: result.data };
    }
  } catch (_error) {
    return {
      valid: false,
      errors: ['Invalid SSO configuration format'],
    };
  }
}

// ============================================================================
// SSO Provider Metadata
// ============================================================================

export interface SSOProviderMetadata {
  id: SSOProvider;
  name: string;
  description: string;
  icon: string;
  requiresEnterprise: boolean;
  configFields: string[];
  docsUrl?: string;
}

export const SSOProviderMetadata: Record<SSOProvider, SSOProviderMetadata> = {
  [SSOProvider.SAML]: {
    id: SSOProvider.SAML,
    name: 'SAML 2.0',
    description: 'Enterprise SSO with SAML 2.0 protocol. Works with Okta, OneLogin, Azure AD, and more.',
    icon: '🔐',
    requiresEnterprise: true,
    configFields: ['entityId', 'ssoUrl', 'certificate'],
    docsUrl: 'https://docs.example.com/sso/saml',
  },
  [SSOProvider.OAUTH_GOOGLE]: {
    id: SSOProvider.OAUTH_GOOGLE,
    name: 'Google OAuth',
    description: 'Sign in with Google Workspace accounts',
    icon: '🔵',
    requiresEnterprise: false,
    configFields: ['clientId', 'clientSecret'],
    docsUrl: 'https://docs.example.com/sso/google',
  },
  [SSOProvider.OAUTH_GITHUB]: {
    id: SSOProvider.OAUTH_GITHUB,
    name: 'GitHub OAuth',
    description: 'Sign in with GitHub accounts',
    icon: '⚫',
    requiresEnterprise: false,
    configFields: ['clientId', 'clientSecret'],
    docsUrl: 'https://docs.example.com/sso/github',
  },
  [SSOProvider.OAUTH_AZURE]: {
    id: SSOProvider.OAUTH_AZURE,
    name: 'Azure AD OAuth',
    description: 'Sign in with Microsoft Azure Active Directory',
    icon: '🔷',
    requiresEnterprise: true,
    configFields: ['clientId', 'clientSecret', 'tenantId'],
    docsUrl: 'https://docs.example.com/sso/azure',
  },
};

// ============================================================================
// SSO Connection Testing
// ============================================================================

/**
 * Test SSO connection (simulated for now)
 * In production, this would validate the IdP metadata and test authentication
 */
export async function testSSOConnection(
  provider: SSOProvider,
  config: SSOConfig
): Promise<{ success: boolean; error?: string; details?: string }> {
  // Validate config first
  const validation = validateSSOConfig(provider, config);
  if (!validation.valid) {
    return {
      success: false,
      error: 'Invalid configuration',
      details: validation.errors?.join(', '),
    };
  }

  // Simulate connection test
  // In production, this would:
  // - For SAML: Validate IdP metadata, check certificate, test SSO URL
  // - For OAuth: Validate client credentials, check endpoints

  return {
    success: true,
    details: `Successfully validated ${SSOProviderMetadata[provider].name} configuration`,
  };
}

// ============================================================================
// SSO User Provisioning
// ============================================================================

export interface SSOUserProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Extract user profile from SSO response
 */
export function extractUserProfile(
  provider: SSOProvider,
  ssoResponse: Record<string, unknown>,
  config: SSOConfig
): SSOUserProfile | null {
  try {
    if (provider === SSOProvider.SAML) {
      const samlConfig = config as SAMLConfig;
      const mapping = samlConfig.attributeMapping ?? {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
      };

      return {
        email: ssoResponse[mapping.email] as string,
        firstName: ssoResponse[mapping.firstName] as string,
        lastName: ssoResponse[mapping.lastName] as string,
        displayName: ssoResponse[mapping.displayName] as string,
        attributes: ssoResponse,
      };
    } else {
      const oauthConfig = config as OAuthConfig;
      const mapping = oauthConfig.userMapping ?? {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        displayName: 'name',
      };

      return {
        email: ssoResponse[mapping.email] as string,
        firstName: ssoResponse[mapping.firstName] as string,
        lastName: ssoResponse[mapping.lastName] as string,
        displayName: ssoResponse[mapping.displayName] as string,
        attributes: ssoResponse,
      };
    }
  } catch (error) {
    console.error('[SSO] Failed to extract user profile:', error);
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get preset configuration for OAuth providers
 */
export function getOAuthPreset(provider: SSOProvider): Partial<OAuthConfig> | null {
  return OAuthPresets[provider] || null;
}

/**
 * Check if provider requires enterprise plan
 */
export function requiresEnterprise(provider: SSOProvider): boolean {
  return SSOProviderMetadata[provider].requiresEnterprise;
}

/**
 * Generate SP metadata URL for SAML
 */
export function getSPMetadataUrl(organizationSlug: string): string {
  return `${getAppBaseUrl()}/api/auth/saml/${organizationSlug}/metadata`;
}

/**
 * Generate ACS URL for SAML
 */
export function getACSUrl(organizationSlug: string): string {
  return `${getAppBaseUrl()}/api/auth/saml/${organizationSlug}/acs`;
}
