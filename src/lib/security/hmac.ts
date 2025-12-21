import { decrypt } from '../utils/crypto';

/**
 * Constant-time string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generates an HMAC signature for a request using Web Crypto API
 * @param secret - The HMAC secret (encrypted in DB)
 * @param method - HTTP method
 * @param path - Request path
 * @param timestamp - Request timestamp (ISO string)
 * @param body - Request body (stringified JSON)
 * @returns HMAC signature
 */
export async function generateHmacSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  body: string = ''
): Promise<string> {
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies an HMAC signature from a request
 * @param encryptedSecret - The encrypted HMAC secret from database
 * @param providedSignature - The signature from request headers
 * @param method - HTTP method
 * @param path - Request path
 * @param timestamp - Request timestamp from headers
 * @param body - Request body
 * @returns Object with verification result
 */
export async function verifyHmacSignature(
  encryptedSecret: string,
  providedSignature: string,
  method: string,
  path: string,
  timestamp: string,
  body: string = ''
): Promise<{
  valid: boolean;
  reason?: string;
}> {
  try {
    // Decrypt the secret
    const secret = await decrypt(encryptedSecret);

    // Check timestamp (prevent replay attacks)
    const timestampDate = new Date(timestamp);
    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - timestampDate.getTime());

    // Allow 5 minutes tolerance
    if (timeDiff > 5 * 60 * 1000) {
      return {
        valid: false,
        reason: 'Request timestamp too old or too far in the future',
      };
    }

    // Generate expected signature
    const expectedSignature = await generateHmacSignature(
      secret,
      method,
      path,
      timestamp,
      body
    );

    // Use constant-time comparison to prevent timing attacks
    if (!timingSafeEqual(providedSignature, expectedSignature)) {
      return {
        valid: false,
        reason: 'Invalid signature',
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('HMAC verification error:', error);
    return {
      valid: false,
      reason: 'Signature verification failed',
    };
  }
}

/**
 * Generates a random HMAC secret using Web Crypto API
 * @returns Random secret string
 */
export function generateHmacSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts HMAC headers from a request
 * @param request - The incoming request
 * @returns Object with signature and timestamp
 */
export function extractHmacHeaders(request: Request): {
  signature?: string;
  timestamp?: string;
} {
  const signature = request.headers.get('x-signature');
  const timestamp = request.headers.get('x-timestamp');

  return {
    signature: signature || undefined,
    timestamp: timestamp || undefined,
  };
}
