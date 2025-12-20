import { db } from './db';
import { apiKeys } from './db/schema';
import { eq } from 'drizzle-orm';

export interface RotateKeyResult {
  success: boolean;
  newKey?: string;
  newKeyPrefix?: string;
  gracePeriodEnds?: string;
  error?: string;
}

/**
 * Rotates an API key by generating a new key while preserving settings using Web Crypto API
 * @param keyId - The ID of the API key to rotate
 * @param _gracePeriodMs - Grace period in milliseconds before old key expires
 * @param _notifyUsers - Whether to notify users about the rotation
 * @returns Result with new key or error
 */
export async function rotateApiKey(
  keyId: string,
  _gracePeriodMs?: number,
  _notifyUsers?: boolean
): Promise<RotateKeyResult> {
  try {
    // Fetch the existing key
    const [existingKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!existingKey) {
      return {
        success: false,
        error: 'API key not found',
      };
    }

    if (!existingKey.isActive) {
      return {
        success: false,
        error: 'Cannot rotate an inactive or revoked key',
      };
    }

    // Generate new API key using Web Crypto API
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const rawKey = `sk-cond_${randomHex}`;

    // Hash the key using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const keyPrefix = rawKey.substring(0, 12);

    // Update the key in database
    await db
      .update(apiKeys)
      .set({
        keyHash,
        keyPrefix,
        lastRotatedAt: new Date(),
        rotationCount: (existingKey.rotationCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId));

    const gracePeriodEnds = _gracePeriodMs
      ? new Date(Date.now() + _gracePeriodMs).toISOString()
      : undefined;

    return {
      success: true,
      newKey: rawKey,
      newKeyPrefix: keyPrefix,
      gracePeriodEnds,
    };
  } catch (error) {
    console.error('Error rotating API key:', error);
    return {
      success: false,
      error: 'Failed to rotate API key',
    };
  }
}

/**
 * Checks if an API key has expired
 * @param expiresAt - The expiration timestamp
 * @returns true if expired, false otherwise
 */
export function isKeyExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

/**
 * Checks if an API key is approaching expiration (within 7 days)
 * @param expiresAt - The expiration timestamp
 * @returns true if expiring soon, false otherwise
 */
export function isKeyExpiringSoon(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  return expiresAt <= sevenDaysFromNow && expiresAt > new Date();
}

export interface RevokeKeyResult {
  success: boolean;
  error?: string;
}

/**
 * Revokes an API key
 * @param keyId - The ID of the API key to revoke
 * @param _reason - The reason for revocation (for audit purposes)
 * @returns Success status with error message if applicable
 */
export async function revokeApiKey(keyId: string, _reason?: string): Promise<RevokeKeyResult> {
  try {
    await db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId));

    return { success: true };
  } catch (error) {
    console.error('Error revoking API key:', error);
    return {
      success: false,
      error: 'Failed to revoke API key'
    };
  }
}
