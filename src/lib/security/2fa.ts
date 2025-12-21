import { encrypt, decrypt } from '../utils/crypto';

/**
 * Generates a random TOTP secret using Web Crypto API
 * @returns Base32 encoded secret
 */
export function generateTotpSecret(): string {
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return base32Encode(array);
}

/**
 * Generates a TOTP code for a given secret and time
 * @param secret - Base32 encoded secret
 * @param timeStep - Time step in seconds (default: 30)
 * @param time - Time to generate code for (default: current time)
 * @returns 6-digit TOTP code
 */
export async function generateTotpCode(
  secret: string,
  timeStep: number = 30,
  time: number = Date.now()
): Promise<string> {
  const counter = Math.floor(time / 1000 / timeStep);

  // Create counter buffer (8 bytes, big-endian)
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  view.setBigUint64(0, BigInt(counter), false); // false = big-endian

  const keyArray = base32Decode(secret);

  // Create a fresh ArrayBuffer to ensure correct type for Web Crypto API
  const keyBuffer = new ArrayBuffer(keyArray.length);
  const keyView = new Uint8Array(keyBuffer);
  keyView.set(keyArray);

  // Import key for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  // Generate HMAC
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hash = new Uint8Array(signature);

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0xf;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

/**
 * Verifies a TOTP code
 * @param secret - Base32 encoded secret (encrypted in DB)
 * @param code - The code to verify
 * @param window - Number of time steps to check (allows for clock drift)
 * @returns true if code is valid
 */
export async function verifyTotpCode(
  secret: string,
  code: string,
  window: number = 1
): Promise<boolean> {
  const now = Date.now();
  const timeStep = 30 * 1000; // 30 seconds in milliseconds

  for (let i = -window; i <= window; i++) {
    const testTime = now + i * timeStep;
    const expectedCode = await generateTotpCode(secret, 30, testTime);

    if (code === expectedCode) {
      return true;
    }
  }

  return false;
}

/**
 * Generates a TOTP URI for QR code generation
 * @param secret - Base32 encoded secret
 * @param email - User's email
 * @param issuer - Application name
 * @returns TOTP URI
 */
export function generateTotpUri(
  secret: string,
  email: string,
  issuer: string = 'Conduit'
): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
    email
  )}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates backup codes for 2FA using Web Crypto API
 * @param count - Number of backup codes to generate
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const hex = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    // Format as XXXX-XXXX
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4)}`);
  }

  return codes;
}

/**
 * Base32 encoding (without padding)
 */
function base32Encode(buffer: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 decoding
 */
function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.ceil((input.length * 5) / 8));

  for (let i = 0; i < input.length; i++) {
    const idx = alphabet.indexOf(input[i].toUpperCase());
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return output.slice(0, index);
}

/**
 * Enables 2FA for an admin user
 * @returns Object with secret and QR code URI
 */
export async function enable2FA(
  email: string
): Promise<{
  secret: string;
  encryptedSecret: string;
  qrCodeUri: string;
  backupCodes: string[];
}> {
  const secret = generateTotpSecret();
  const encryptedSecret = await encrypt(secret);
  const qrCodeUri = generateTotpUri(secret, email);
  const backupCodes = generateBackupCodes();

  return {
    secret,
    encryptedSecret,
    qrCodeUri,
    backupCodes,
  };
}

/**
 * Verifies a 2FA code for an admin user
 * @param encryptedSecret - Encrypted secret from database
 * @param code - Code to verify
 * @returns true if valid
 */
export async function verify2FACode(encryptedSecret: string, code: string): Promise<boolean> {
  try {
    const secret = await decrypt(encryptedSecret);
    return verifyTotpCode(secret, code);
  } catch (error) {
    console.error('2FA verification error:', error);
    return false;
  }
}

/**
 * Helper function to setup TOTP for API routes
 * @param name - Name for the TOTP entry (e.g., API key name)
 * @param email - User's email
 * @returns Object with setup details
 */
export async function setupTOTP(name: string, email: string): Promise<{
  secret: string;
  qrCode: string;
  manualEntryKey: string;
}> {
  const secret = generateTotpSecret();
  const qrCode = generateTotpUri(secret, email, name);

  return {
    secret: await encrypt(secret),
    qrCode,
    manualEntryKey: secret,
  };
}

/**
 * Helper function to verify TOTP for API routes
 * @param encryptedSecret - Encrypted secret from database
 * @param code - Code to verify
 * @returns true if valid
 */
export async function verifyTOTP(encryptedSecret: string, code: string): Promise<boolean> {
  return verify2FACode(encryptedSecret, code);
}
