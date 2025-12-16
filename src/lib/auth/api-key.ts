import { db } from '@/lib/db';
import { apiKeys, type ApiKey } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Hash an API key using SHA-256 (Web Crypto API - edge-compatible)
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a secure random API key with format: sk-cond_{random}
 * Returns: { fullKey, keyHash, keyPrefix }
 */
export async function generateApiKey(): Promise<{
  fullKey: string;
  keyHash: string;
  keyPrefix: string;
}> {
  // Generate 32 random bytes (256 bits)
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  // Convert to base64url (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Create the full key with prefix
  const fullKey = `sk-cond_${base64}`;

  // Hash the full key for storage
  const keyHash = await hashApiKey(fullKey);

  // Extract prefix for display (first 12 chars: "sk-cond_abcd")
  const keyPrefix = fullKey.substring(0, 12);

  return {
    fullKey,
    keyHash,
    keyPrefix,
  };
}

/**
 * Validate an API key and return the associated configuration
 * Returns null if key is invalid, revoked, or inactive
 */
export async function validateApiKey(key: string): Promise<ApiKey | null> {
  try {
    // Hash the provided key
    const keyHash = await hashApiKey(key);

    // Look up in database
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.isActive, true),
          isNull(apiKeys.revokedAt)
        )
      )
      .limit(1);

    if (!apiKey) {
      return null;
    }

    return apiKey;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
}

/**
 * Extract API key from Authorization header
 * Supports: "Bearer sk-cond_xxx" or "sk-cond_xxx"
 */
export function extractApiKeyFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Remove "Bearer " prefix if present
  const key = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  // Validate format: starts with "sk-cond_"
  if (!key.startsWith('sk-cond_')) {
    return null;
  }

  return key;
}

/**
 * Validate API key from request headers
 * Returns the API key configuration or null if invalid
 */
export async function validateApiKeyFromHeaders(
  headers: Headers
): Promise<ApiKey | null> {
  const authHeader = headers.get('authorization');
  const apiKey = extractApiKeyFromHeader(authHeader);

  if (!apiKey) {
    return null;
  }

  return await validateApiKey(apiKey);
}
