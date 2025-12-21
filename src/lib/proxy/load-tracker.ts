/**
 * Provider load tracking service
 * Tracks active requests per provider for least-loaded strategy
 * Uses Vercel KV (Redis) for atomic operations at the edge
 */

import { kv } from '@vercel/kv';

/**
 * Increment active request count for a provider
 * Called when a request starts
 */
export async function incrementProviderLoad(providerId: string): Promise<void> {
  const key = `provider-load:${providerId}:active`;

  try {
    await kv.pipeline()
      .incr(key)
      .expire(key, 300) // 5 minutes TTL as safety (reset if provider becomes stuck)
      .exec();
  } catch (error) {
    console.error(`[LoadTracker] Failed to increment load for provider ${providerId}:`, error);
    // Don't throw - load tracking is best-effort
  }
}

/**
 * Decrement active request count for a provider
 * Called when a request completes (success or failure)
 */
export async function decrementProviderLoad(providerId: string): Promise<void> {
  const key = `provider-load:${providerId}:active`;

  try {
    // Get current value first to avoid going negative
    const currentLoad = await kv.get<number>(key);

    if (currentLoad && currentLoad > 0) {
      await kv.decr(key);
    }
  } catch (error) {
    console.error(`[LoadTracker] Failed to decrement load for provider ${providerId}:`, error);
    // Don't throw - load tracking is best-effort
  }
}

/**
 * Get current active request count for a provider
 * Used by least-loaded strategy to select provider
 */
export async function getProviderLoad(providerId: string): Promise<number> {
  const key = `provider-load:${providerId}:active`;

  try {
    const load = await kv.get<number>(key);
    return load || 0;
  } catch (error) {
    console.error(`[LoadTracker] Failed to get load for provider ${providerId}:`, error);
    return 0; // Return 0 on error (fail-safe)
  }
}

/**
 * Get load for multiple providers at once (batch operation)
 * More efficient than calling getProviderLoad for each provider
 */
export async function getBatchProviderLoads(providerIds: string[]): Promise<Map<string, number>> {
  const loadMap = new Map<string, number>();

  try {
    // Batch get all load values
    const keys = providerIds.map((id) => `provider-load:${id}:active`);
    const loads = await kv.mget<number[]>(...keys);

    providerIds.forEach((id, index) => {
      loadMap.set(id, loads[index] || 0);
    });
  } catch (error) {
    console.error('[LoadTracker] Failed to get batch loads:', error);
    // Return empty map - let selection fall back to other criteria
    providerIds.forEach((id) => loadMap.set(id, 0));
  }

  return loadMap;
}

/**
 * Reset load counter for a provider (admin/debug use)
 */
export async function resetProviderLoad(providerId: string): Promise<void> {
  const key = `provider-load:${providerId}:active`;

  try {
    await kv.del(key);
  } catch (error) {
    console.error(`[LoadTracker] Failed to reset load for provider ${providerId}:`, error);
  }
}

/**
 * Get all provider loads (for monitoring dashboard)
 */
export async function getAllProviderLoads(): Promise<Map<string, number>> {
  const loadMap = new Map<string, number>();

  try {
    // Scan for all provider-load keys
    const keys: string[] = [];
    let cursor: string | number = 0;

    do {
      const result: [string | number, string[]] = await kv.scan(cursor, {
        match: 'provider-load:*:active',
        count: 100,
      });

      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0 && cursor !== '0');

    // Get all values
    if (keys.length > 0) {
      const loads = await kv.mget<number[]>(...keys);

      keys.forEach((key, index) => {
        // Extract provider ID from key: provider-load:{providerId}:active
        const providerId = key.split(':')[1];
        loadMap.set(providerId, loads[index] || 0);
      });
    }
  } catch (error) {
    console.error('[LoadTracker] Failed to get all provider loads:', error);
  }

  return loadMap;
}
