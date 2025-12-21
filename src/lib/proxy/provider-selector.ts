/**
 * Provider selector orchestrator
 * Main entry point for provider selection with auto-balance and auto-choose
 */

import { db } from '@/lib/db';
import { providers, type ApiKey, type Provider } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { getCachedProviderPool } from './provider-pool';
import { selectProviders, type SelectionStrategyType } from './selection-strategies';

/**
 * Get single provider by ID (cached)
 * Used for backward compatibility with single-provider API keys
 */
const getCachedProvider = unstable_cache(
  async (providerId: string): Promise<Provider | null> => {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);

    return provider || null;
  },
  ['provider'],
  {
    revalidate: 300, // 5 minutes
    tags: ['provider'],
  }
);

/**
 * Select providers for a request based on API key configuration
 * Handles both single-provider and multi-provider modes
 * Returns providers ordered by selection strategy (for failover)
 */
export async function selectProvidersForRequest(
  apiKey: ApiKey,
  model?: string
): Promise<Provider[]> {
  const strategy: SelectionStrategyType =
    (apiKey.providerSelectionStrategy as SelectionStrategyType) || 'single';

  // Backward compatibility: single strategy with providerId
  if (strategy === 'single' && apiKey.providerId) {
    const provider = await getCachedProvider(apiKey.providerId);
    return provider ? [provider] : [];
  }

  // Multi-provider mode: get provider pool from junction table
  const pool = await getCachedProviderPool(apiKey.id);

  if (pool.length === 0) {
    console.warn(
      `[ProviderSelector] API key ${apiKey.id} has no providers in pool, falling back to providerId`
    );

    // Fallback: try to use providerId if available
    if (apiKey.providerId) {
      const provider = await getCachedProvider(apiKey.providerId);
      return provider ? [provider] : [];
    }

    return [];
  }

  // Filter: only active AND healthy providers
  const healthyProviders = pool.filter(
    (p) => p.isActive && p.status === 'healthy'
  );

  if (healthyProviders.length === 0) {
    console.warn(
      `[ProviderSelector] API key ${apiKey.id} has no healthy providers, using all active providers`
    );

    // Fallback: use all active providers (even if unhealthy)
    const activeProviders = pool.filter((p) => p.isActive);

    if (activeProviders.length === 0) {
      console.error(
        `[ProviderSelector] API key ${apiKey.id} has no active providers at all`
      );
      return [];
    }

    return await selectProviders(strategy, {
      apiKeyId: apiKey.id,
      providers: activeProviders,
      model,
    });
  }

  // Apply selection strategy
  const selectedProviders = await selectProviders(strategy, {
    apiKeyId: apiKey.id,
    providers: healthyProviders,
    model,
  });

  return selectedProviders;
}

/**
 * Get provider for single-provider API key (legacy method)
 * For backward compatibility
 */
export async function getSingleProvider(apiKey: ApiKey): Promise<Provider | null> {
  if (!apiKey.providerId) {
    return null;
  }

  return await getCachedProvider(apiKey.providerId);
}

/**
 * Validate that an API key has at least one usable provider
 */
export async function hasUsableProviders(apiKey: ApiKey): Promise<boolean> {
  const providers = await selectProvidersForRequest(apiKey);
  return providers.length > 0;
}

/**
 * Get provider statistics for an API key
 * Useful for debugging and monitoring
 */
export async function getProviderStats(apiKey: ApiKey): Promise<{
  total: number;
  active: number;
  healthy: number;
  strategy: string;
}> {
  const strategy = apiKey.providerSelectionStrategy || 'single';

  if (strategy === 'single' && apiKey.providerId) {
    const provider = await getCachedProvider(apiKey.providerId);

    if (!provider) {
      return { total: 0, active: 0, healthy: 0, strategy };
    }

    return {
      total: 1,
      active: provider.isActive ? 1 : 0,
      healthy: provider.status === 'healthy' ? 1 : 0,
      strategy,
    };
  }

  const pool = await getCachedProviderPool(apiKey.id);

  return {
    total: pool.length,
    active: pool.filter((p) => p.isActive).length,
    healthy: pool.filter((p) => p.status === 'healthy').length,
    strategy,
  };
}
