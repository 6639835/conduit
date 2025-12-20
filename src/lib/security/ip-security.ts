import { ApiKey } from '../db/schema';

/**
 * Checks if an IP address matches a pattern (supports CIDR notation)
 * @param ip - The IP address to check
 * @param pattern - The pattern to match (can be exact IP or CIDR range)
 * @returns true if IP matches the pattern
 */
function matchesIpPattern(ip: string, pattern: string): boolean {
  // Exact match
  if (ip === pattern) return true;

  // CIDR notation check
  if (pattern.includes('/')) {
    return isIpInCidr(ip, pattern);
  }

  // Wildcard support (e.g., 192.168.1.*)
  if (pattern.includes('*')) {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
    );
    return regex.test(ip);
  }

  return false;
}

/**
 * Checks if an IP is within a CIDR range
 * @param ip - The IP address to check
 * @param cidr - The CIDR notation (e.g., "192.168.1.0/24")
 * @returns true if IP is in range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);

  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Converts an IP address to a number
 * @param ip - The IP address
 * @returns Numeric representation
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
}

/**
 * Validates if an IP address is allowed based on whitelist/blacklist
 * @param ip - The IP address to validate
 * @param apiKey - The API key object with security settings
 * @returns Object with validation result
 */
export function validateIpAccess(
  ip: string,
  apiKey: Pick<ApiKey, 'ipWhitelist' | 'ipBlacklist'>
): {
  allowed: boolean;
  reason?: string;
} {
  const whitelist = apiKey.ipWhitelist as string[] | null;
  const blacklist = apiKey.ipBlacklist as string[] | null;

  // Check blacklist first
  if (blacklist && blacklist.length > 0) {
    const isBlocked = blacklist.some((pattern) => matchesIpPattern(ip, pattern));
    if (isBlocked) {
      return {
        allowed: false,
        reason: 'IP address is blacklisted',
      };
    }
  }

  // Check whitelist (if configured)
  if (whitelist && whitelist.length > 0) {
    const isAllowed = whitelist.some((pattern) => matchesIpPattern(ip, pattern));
    if (!isAllowed) {
      return {
        allowed: false,
        reason: 'IP address not in whitelist',
      };
    }
  }

  return { allowed: true };
}

/**
 * Extracts the client IP address from a request
 * @param request - The incoming request
 * @returns The client IP address
 */
export function getClientIp(request: Request): string {
  // Check common headers for forwarded IPs (in order of preference)
  const headers = request.headers;

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Fallback (though this might not be available in Edge runtime)
  return 'unknown';
}

/**
 * Validates if an IP is a valid IPv4 address
 * @param ip - The IP address to validate
 * @returns true if valid IPv4
 */
export function isValidIpv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;

  const octets = ip.split('.');
  return octets.every((octet) => {
    const num = parseInt(octet);
    return num >= 0 && num <= 255;
  });
}

/**
 * Validates CIDR notation
 * @param cidr - The CIDR string to validate
 * @returns true if valid CIDR
 */
export function isValidCidr(cidr: string): boolean {
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;

  const [ip, bits] = parts;
  if (!isValidIpv4(ip)) return false;

  const bitsNum = parseInt(bits);
  return bitsNum >= 0 && bitsNum <= 32;
}
