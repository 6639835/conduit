/**
 * Encryption utilities for securely storing sensitive data (like target API keys)
 * Uses AES-256-GCM with Web Crypto API (edge-compatible)
 */

if (!process.env.API_KEY_ENCRYPTION_KEY) {
  throw new Error('API_KEY_ENCRYPTION_KEY environment variable is not set');
}

// Derive encryption key from hex string
const ENCRYPTION_KEY_HEX = process.env.API_KEY_ENCRYPTION_KEY;

// Validate encryption key format (must be 64 hex characters for 256-bit key)
if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY_HEX)) {
  throw new Error('API_KEY_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (256 bits)');
}

// Validate key entropy (prevent weak keys like all zeros or repeated patterns)
function validateKeyEntropy(hexKey: string): void {
  // Check for all zeros or all same character
  if (/^(.)\1*$/.test(hexKey)) {
    throw new Error('API_KEY_ENCRYPTION_KEY has insufficient entropy (all same character)');
  }

  // Count unique characters (should have reasonable diversity)
  const uniqueChars = new Set(hexKey.toLowerCase()).size;
  if (uniqueChars < 8) {
    throw new Error('API_KEY_ENCRYPTION_KEY has insufficient entropy (too few unique characters)');
  }

  // Check for simple patterns (e.g., "0123456789abcdef" repeated)
  const firstQuarter = hexKey.substring(0, 16);
  const repeatedPattern = firstQuarter.repeat(4);
  if (hexKey.toLowerCase() === repeatedPattern.toLowerCase()) {
    throw new Error('API_KEY_ENCRYPTION_KEY has insufficient entropy (repeated pattern detected)');
  }
}

validateKeyEntropy(ENCRYPTION_KEY_HEX);

/**
 * Get the encryption key as CryptoKey
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // Convert hex string to bytes
  const keyBytes = new Uint8Array(
    ENCRYPTION_KEY_HEX.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  // Import as CryptoKey
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: base64-encoded encrypted data with IV prepended
 * Format: {iv(12 bytes)}{ciphertext}{authTag(16 bytes)}
 */
export async function encrypt(plaintext: string): Promise<string> {
  try {
    const key = await getEncryptionKey();

    // Generate random IV (12 bytes for GCM)
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    // Encode plaintext
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string that was encrypted with encrypt()
 * Expects: base64-encoded data with IV prepended
 */
export async function decrypt(encrypted: string): Promise<string> {
  try {
    const key = await getEncryptionKey();

    // Decode from base64
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

    // Extract IV (first 12 bytes)
    const iv = combined.slice(0, 12);

    // Extract ciphertext (remaining bytes)
    const ciphertext = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    // Decode plaintext
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt a provider credential for storage in database
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
  return await encrypt(apiKey);
}

/**
 * Decrypt a provider credential from database
 */
export async function decryptApiKey(encryptedKey: string): Promise<string> {
  return await decrypt(encryptedKey);
}
