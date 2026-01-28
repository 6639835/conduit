/**
 * Multi-Region Routing
 * Geographic provider distribution, regional failover, data residency, latency routing
 */

import { db } from '@/lib/db';
import { providers } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { kv } from '@vercel/kv';

export interface Region {
  code: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  continent: string;
  dataResidencyCompliant: boolean;
}

/**
 * Available regions with geographic coordinates
 */
export const REGIONS: Record<string, Region> = {
  // North America
  'us-east-1': {
    code: 'us-east-1',
    name: 'US East (N. Virginia)',
    location: { lat: 38.9072, lng: -77.0369 },
    continent: 'North America',
    dataResidencyCompliant: true,
  },
  'us-west-1': {
    code: 'us-west-1',
    name: 'US West (N. California)',
    location: { lat: 37.3861, lng: -122.0839 },
    continent: 'North America',
    dataResidencyCompliant: true,
  },
  'us-west-2': {
    code: 'us-west-2',
    name: 'US West (Oregon)',
    location: { lat: 45.5234, lng: -122.6762 },
    continent: 'North America',
    dataResidencyCompliant: true,
  },
  'ca-central-1': {
    code: 'ca-central-1',
    name: 'Canada (Montreal)',
    location: { lat: 45.5017, lng: -73.5673 },
    continent: 'North America',
    dataResidencyCompliant: true,
  },

  // Europe
  'eu-west-1': {
    code: 'eu-west-1',
    name: 'EU (Ireland)',
    location: { lat: 53.3498, lng: -6.2603 },
    continent: 'Europe',
    dataResidencyCompliant: true,
  },
  'eu-west-2': {
    code: 'eu-west-2',
    name: 'EU (London)',
    location: { lat: 51.5074, lng: -0.1278 },
    continent: 'Europe',
    dataResidencyCompliant: true,
  },
  'eu-central-1': {
    code: 'eu-central-1',
    name: 'EU (Frankfurt)',
    location: { lat: 50.1109, lng: 8.6821 },
    continent: 'Europe',
    dataResidencyCompliant: true,
  },

  // Asia Pacific
  'ap-southeast-1': {
    code: 'ap-southeast-1',
    name: 'Asia Pacific (Singapore)',
    location: { lat: 1.3521, lng: 103.8198 },
    continent: 'Asia',
    dataResidencyCompliant: true,
  },
  'ap-southeast-2': {
    code: 'ap-southeast-2',
    name: 'Asia Pacific (Sydney)',
    location: { lat: -33.8688, lng: 151.2093 },
    continent: 'Asia',
    dataResidencyCompliant: true,
  },
  'ap-northeast-1': {
    code: 'ap-northeast-1',
    name: 'Asia Pacific (Tokyo)',
    location: { lat: 35.6762, lng: 139.6503 },
    continent: 'Asia',
    dataResidencyCompliant: true,
  },
  'ap-south-1': {
    code: 'ap-south-1',
    name: 'Asia Pacific (Mumbai)',
    location: { lat: 19.0760, lng: 72.8777 },
    continent: 'Asia',
    dataResidencyCompliant: true,
  },

  // South America
  'sa-east-1': {
    code: 'sa-east-1',
    name: 'South America (São Paulo)',
    location: { lat: -23.5505, lng: -46.6333 },
    continent: 'South America',
    dataResidencyCompliant: true,
  },
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Estimate latency based on distance (rough approximation)
 * ~1ms per 100km for fiber optic cables
 */
export function estimateLatency(distanceKm: number): number {
  const propagationDelay = distanceKm / 100; // Base propagation delay
  const routingOverhead = 10; // Additional routing/processing overhead
  return Math.ceil(propagationDelay + routingOverhead);
}

/**
 * Get user's approximate location from IP address
 * Returns { lat, lng, region }
 */
export async function getUserLocation(ipAddress: string): Promise<{
  lat: number;
  lng: number;
  region?: string;
  country?: string;
  city?: string;
}> {
  // Check cache first
  const cacheKey = `geo:${ipAddress}`;
  const cached = await kv.get<{
    lat: number;
    lng: number;
    region?: string;
    country?: string;
    city?: string;
  }>(cacheKey);
  if (cached) return cached;

  try {
    // Use ipapi.co for geolocation (free tier: 1000 req/day)
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);

    if (!response.ok) {
      // Fallback to default US East location
      return {
        lat: 38.9072,
        lng: -77.0369,
        region: 'us-east-1',
        country: 'US',
        city: 'Unknown',
      };
    }

    const data = await response.json();

    const location = {
      lat: data.latitude || 38.9072,
      lng: data.longitude || -77.0369,
      country: data.country_code,
      city: data.city,
      region: inferRegionFromCountry(data.country_code),
    };

    // Cache for 1 day
    await kv.set(cacheKey, location, { ex: 86400 });

    return location;
  } catch (error) {
    console.error('Error getting user location:', error);
    // Return default location
    return {
      lat: 38.9072,
      lng: -77.0369,
      region: 'us-east-1',
      country: 'US',
      city: 'Unknown',
    };
  }
}

/**
 * Infer AWS region from country code
 */
function inferRegionFromCountry(countryCode: string): string {
  const countryToRegion: Record<string, string> = {
    US: 'us-east-1',
    CA: 'ca-central-1',
    GB: 'eu-west-2',
    IE: 'eu-west-1',
    DE: 'eu-central-1',
    FR: 'eu-west-1',
    SG: 'ap-southeast-1',
    AU: 'ap-southeast-2',
    JP: 'ap-northeast-1',
    IN: 'ap-south-1',
    BR: 'sa-east-1',
  };

  return countryToRegion[countryCode] || 'us-east-1';
}

/**
 * Find nearest region to user location
 */
export function findNearestRegion(userLat: number, userLng: number): string {
  let nearestRegion = 'us-east-1';
  let minDistance = Infinity;

  for (const [code, region] of Object.entries(REGIONS)) {
    const distance = calculateDistance(
      userLat,
      userLng,
      region.location.lat,
      region.location.lng
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestRegion = code;
    }
  }

  return nearestRegion;
}

/**
 * Get regional latency measurements
 */
export interface RegionalLatency {
  region: string;
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
  measurementCount: number;
  lastMeasured: Date | null;
}

export async function getRegionalLatency(
  _hours: number = 24
): Promise<RegionalLatency[]> {
  // This would query requestLogs grouped by region
  // For now, return mock data structure
  return Object.keys(REGIONS).map(region => ({
    region,
    avgLatency: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    measurementCount: 0,
    lastMeasured: null,
  }));
}

/**
 * Select optimal region based on user location and data residency requirements
 */
export interface RegionSelectionOptions {
  userLocation?: {
    lat: number;
    lng: number;
  };
  requireContinent?: string;
  requireCountry?: string;
  preferLowLatency?: boolean;
  dataResidencyRequired?: boolean;
}

export async function selectOptimalRegion(
  options: RegionSelectionOptions
): Promise<string> {
  let candidateRegions = Object.values(REGIONS);

  // Filter by data residency
  if (options.dataResidencyRequired) {
    candidateRegions = candidateRegions.filter(r => r.dataResidencyCompliant);
  }

  // Filter by continent
  if (options.requireContinent) {
    candidateRegions = candidateRegions.filter(
      r => r.continent === options.requireContinent
    );
  }

  // If no user location, return first candidate
  if (!options.userLocation || candidateRegions.length === 0) {
    return candidateRegions[0]?.code || 'us-east-1';
  }

  // Find nearest region based on latency
  let bestRegion = candidateRegions[0];
  let minLatency = Infinity;

  for (const region of candidateRegions) {
    const distance = calculateDistance(
      options.userLocation.lat,
      options.userLocation.lng,
      region.location.lat,
      region.location.lng
    );
    const latency = estimateLatency(distance);

    if (latency < minLatency) {
      minLatency = latency;
      bestRegion = region;
    }
  }

  return bestRegion.code;
}

/**
 * Get providers in a specific region
 */
export async function getProvidersInRegion(
  region: string,
  includeGlobal: boolean = true
): Promise<Array<{
  id: string;
  name: string;
  type: string;
  model: string | null;
  region: string | null;
  priority: number;
}>> {
  const regionalProviders = await db
    .select({
      id: providers.id,
      name: providers.name,
      type: providers.type,
      model: providers.model,
      region: providers.region,
      priority: providers.priority,
    })
    .from(providers)
    .where(and(eq(providers.isActive, true), eq(providers.region, region)));

  // Also get global providers (region = null)
  if (includeGlobal) {
    const globalProviders = await db
      .select({
        id: providers.id,
        name: providers.name,
        type: providers.type,
        model: providers.model,
        region: providers.region,
        priority: providers.priority,
      })
      .from(providers)
      .where(
        and(
          eq(providers.isActive, true),
          isNull(providers.region)
        )
      );

    return [...regionalProviders, ...globalProviders];
  }

  return regionalProviders;
}

/**
 * Regional failover - find alternative providers in nearby regions
 */
export async function getFailoverProviders(
  primaryRegion: string,
  maxLatencyMs: number = 100
): Promise<string[]> {
  const primaryRegionData = REGIONS[primaryRegion];
  if (!primaryRegionData) return [];

  // Find regions within acceptable latency
  const nearbyRegions: string[] = [];

  for (const [code, region] of Object.entries(REGIONS)) {
    if (code === primaryRegion) continue;

    const distance = calculateDistance(
      primaryRegionData.location.lat,
      primaryRegionData.location.lng,
      region.location.lat,
      region.location.lng
    );

    const estimatedLatency = estimateLatency(distance);

    if (estimatedLatency <= maxLatencyMs) {
      nearbyRegions.push(code);
    }
  }

  // Sort by distance
  nearbyRegions.sort((a, b) => {
    const distA = calculateDistance(
      primaryRegionData.location.lat,
      primaryRegionData.location.lng,
      REGIONS[a].location.lat,
      REGIONS[a].location.lng
    );
    const distB = calculateDistance(
      primaryRegionData.location.lat,
      primaryRegionData.location.lng,
      REGIONS[b].location.lat,
      REGIONS[b].location.lng
    );
    return distA - distB;
  });

  return nearbyRegions;
}

/**
 * Data residency compliance check
 */
export interface DataResidencyRequirement {
  allowedRegions?: string[];
  allowedContinents?: string[];
  forbiddenRegions?: string[];
  forbiddenCountries?: string[];
}

export function checkDataResidency(
  region: string,
  requirements: DataResidencyRequirement
): boolean {
  const regionData = REGIONS[region];
  if (!regionData) return false;

  // Check forbidden regions
  if (requirements.forbiddenRegions?.includes(region)) {
    return false;
  }

  // Check allowed regions (if specified, must match)
  if (requirements.allowedRegions && requirements.allowedRegions.length > 0) {
    if (!requirements.allowedRegions.includes(region)) {
      return false;
    }
  }

  // Check allowed continents
  if (requirements.allowedContinents && requirements.allowedContinents.length > 0) {
    if (!requirements.allowedContinents.includes(regionData.continent)) {
      return false;
    }
  }

  return true;
}
