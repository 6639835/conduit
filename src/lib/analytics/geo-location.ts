/**
 * Geographic Location Analytics
 *
 * Provides IP-to-location mapping and geographic usage statistics.
 * Uses a lightweight IP geolocation approach without external dependencies.
 */

import { db } from '@/lib/db';
import { usageLogs } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';

export interface GeoLocation {
  country: string;
  countryCode: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface GeoUsageStats {
  country: string;
  countryCode: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  percentage: number;
  cities?: Array<{
    city: string;
    requestCount: number;
  }>;
}

/**
 * Simple IP to country mapping using IP ranges
 * Note: For production, consider using a full GeoIP database or service
 */
export function getCountryFromIp(ip: string): GeoLocation | null {
  if (!ip) return null;

  // Handle localhost and private IPs
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {
      country: 'Local',
      countryCode: 'LOCAL',
    };
  }

  // Simple country detection based on IP ranges
  // This is a simplified example - in production, use a proper GeoIP database
  const ipParts = ip.split('.').map(Number);
  if (ipParts.length !== 4) return null;

  const firstOctet = ipParts[0];

  // Simplified mapping (extend this with real IP range data)
  const ranges: Record<string, GeoLocation> = {
    // US ranges (example)
    '3': { country: 'United States', countryCode: 'US' },
    '4': { country: 'United States', countryCode: 'US' },
    '8': { country: 'United States', countryCode: 'US' },
    '12': { country: 'United States', countryCode: 'US' },

    // EU ranges (example)
    '2': { country: 'Europe', countryCode: 'EU' },
    '5': { country: 'Europe', countryCode: 'EU' },

    // Asia ranges (example)
    '1': { country: 'Asia Pacific', countryCode: 'APAC' },
    '14': { country: 'Asia Pacific', countryCode: 'APAC' },

    // Default
    'default': { country: 'Unknown', countryCode: 'XX' },
  };

  return ranges[firstOctet.toString()] || ranges['default'];
}

/**
 * Enhanced IP geolocation using a free API (fallback)
 * This is used for more accurate results when needed
 */
export async function getLocationFromIpAPI(ip: string): Promise<GeoLocation | null> {
  try {
    // Use a free IP geolocation API (ip-api.com)
    const response = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,lat,lon`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.status !== 'success') return null;

    return {
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
    };
  } catch (error) {
    console.error('IP geolocation API error:', error);
    return null;
  }
}

/**
 * Get geographic usage statistics for an API key
 */
export async function getGeoUsageStats(
  apiKeyId: string,
  days: number = 30
): Promise<GeoUsageStats[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Query usage logs with IP addresses
  const logs = await db
    .select({
      ip: usageLogs.ipAddress,
      tokensInput: usageLogs.tokensInput,
      tokensOutput: usageLogs.tokensOutput,
      costUsd: usageLogs.costUsd,
    })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.apiKeyId, apiKeyId),
        gte(usageLogs.timestamp, startDate)
      )
    );

  // Group by country
  const countryMap = new Map<string, {
    country: string;
    countryCode: string;
    requestCount: number;
    totalTokens: number;
    totalCost: number;
  }>();

  for (const log of logs) {
    const location = getCountryFromIp(log.ip || '');
    if (!location) continue;

    const key = location.countryCode;
    const existing = countryMap.get(key);

    if (existing) {
      existing.requestCount++;
      existing.totalTokens += (log.tokensInput || 0) + (log.tokensOutput || 0);
      existing.totalCost += log.costUsd || 0;
    } else {
      countryMap.set(key, {
        country: location.country,
        countryCode: location.countryCode,
        requestCount: 1,
        totalTokens: (log.tokensInput || 0) + (log.tokensOutput || 0),
        totalCost: log.costUsd || 0,
      });
    }
  }

  // Calculate percentages
  const totalRequests = logs.length;
  const stats: GeoUsageStats[] = Array.from(countryMap.values()).map((stat) => ({
    ...stat,
    percentage: totalRequests > 0 ? (stat.requestCount / totalRequests) * 100 : 0,
  }));

  // Sort by request count (descending)
  stats.sort((a, b) => b.requestCount - a.requestCount);

  return stats;
}

/**
 * Get geographic usage statistics aggregated across all keys
 */
export async function getGlobalGeoUsageStats(days: number = 30): Promise<GeoUsageStats[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Query all usage logs
  const logs = await db
    .select({
      ip: usageLogs.ipAddress,
      tokensInput: usageLogs.tokensInput,
      tokensOutput: usageLogs.tokensOutput,
      costUsd: usageLogs.costUsd,
    })
    .from(usageLogs)
    .where(gte(usageLogs.timestamp, startDate));

  // Group by country (same logic as above)
  const countryMap = new Map<string, {
    country: string;
    countryCode: string;
    requestCount: number;
    totalTokens: number;
    totalCost: number;
  }>();

  for (const log of logs) {
    const location = getCountryFromIp(log.ip || '');
    if (!location) continue;

    const key = location.countryCode;
    const existing = countryMap.get(key);

    if (existing) {
      existing.requestCount++;
      existing.totalTokens += (log.tokensInput || 0) + (log.tokensOutput || 0);
      existing.totalCost += log.costUsd || 0;
    } else {
      countryMap.set(key, {
        country: location.country,
        countryCode: location.countryCode,
        requestCount: 1,
        totalTokens: (log.tokensInput || 0) + (log.tokensOutput || 0),
        totalCost: log.costUsd || 0,
      });
    }
  }

  const totalRequests = logs.length;
  const stats: GeoUsageStats[] = Array.from(countryMap.values()).map((stat) => ({
    ...stat,
    percentage: totalRequests > 0 ? (stat.requestCount / totalRequests) * 100 : 0,
  }));

  stats.sort((a, b) => b.requestCount - a.requestCount);

  return stats;
}

/**
 * Get top cities for a specific country
 */
export async function getCityUsageStats(
  _apiKeyId: string,
  _countryCode: string,
  _days: number = 30
): Promise<Array<{ city: string; requestCount: number }>> {
  // This is a placeholder - in production, you'd need to store city data
  // For now, return empty array
  return [];
}

/**
 * Country code to flag emoji mapping
 */
export function getCountryFlag(countryCode: string): string {
  if (countryCode === 'LOCAL') return '🏠';
  if (countryCode === 'XX') return '🌐';

  // Convert country code to flag emoji
  // Each letter maps to regional indicator symbol
  const offset = 127397;
  const flag = countryCode
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + offset))
    .join('');

  return flag;
}

/**
 * Get country name from code
 */
export function getCountryName(countryCode: string): string {
  const countries: Record<string, string> = {
    US: 'United States',
    CA: 'Canada',
    GB: 'United Kingdom',
    DE: 'Germany',
    FR: 'France',
    IT: 'Italy',
    ES: 'Spain',
    NL: 'Netherlands',
    BE: 'Belgium',
    CH: 'Switzerland',
    AU: 'Australia',
    NZ: 'New Zealand',
    JP: 'Japan',
    CN: 'China',
    IN: 'India',
    SG: 'Singapore',
    KR: 'South Korea',
    BR: 'Brazil',
    MX: 'Mexico',
    AR: 'Argentina',
    ZA: 'South Africa',
    EU: 'Europe',
    APAC: 'Asia Pacific',
    LOCAL: 'Local',
    XX: 'Unknown',
  };

  return countries[countryCode] || countryCode;
}
