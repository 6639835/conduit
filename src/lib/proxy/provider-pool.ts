/**
 * Provider pool management service
 * Handles many-to-many relationship between API keys and providers
 */

import { db } from '@/lib/db';
import { apiKeyProviders, providers, type Provider } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Get provider pool for an API key
 * Returns providers ordered by priority (descending)
 */
export async function getProviderPool(apiKeyId: string): Promise<Provider[]> {
  try {
    const results = await db
      .select({
        provider: providers,
      })
      .from(apiKeyProviders)
      .innerJoin(providers, eq(apiKeyProviders.providerId, providers.id))
      .where(
        and(
          eq(apiKeyProviders.apiKeyId, apiKeyId),
          eq(apiKeyProviders.isActive, true)
        )
      )
      .orderBy(desc(apiKeyProviders.priority));

    return results.map((r) => r.provider);
  } catch (error) {
    console.error(`[ProviderPool] Failed to get provider pool for API key ${apiKeyId}:`, error);
    return [];
  }
}

/**
 * Get cached provider pool for an API key
 * Cache TTL: 5 minutes (300 seconds)
 * Revalidate tag: provider-pool:{apiKeyId}
 */
export const getCachedProviderPool = unstable_cache(
  async (apiKeyId: string) => getProviderPool(apiKeyId),
  ['provider-pool'],
  {
    revalidate: 300, // 5 minutes
    tags: (apiKeyId: string) => [`provider-pool:${apiKeyId}`],
  }
);

/**
 * Add a provider to an API key's pool
 */
export async function addProviderToPool(
  apiKeyId: string,
  providerId: string,
  priority: number = 0
): Promise<void> {
  try {
    await db.insert(apiKeyProviders).values({
      apiKeyId,
      providerId,
      priority,
      isActive: true,
    });
  } catch (error) {
    console.error(
      `[ProviderPool] Failed to add provider ${providerId} to pool for API key ${apiKeyId}:`,
      error
    );
    throw new Error('Failed to add provider to pool');
  }
}

/**
 * Remove a provider from an API key's pool
 */
export async function removeProviderFromPool(
  apiKeyId: string,
  providerId: string
): Promise<void> {
  try {
    await db
      .delete(apiKeyProviders)
      .where(
        and(
          eq(apiKeyProviders.apiKeyId, apiKeyId),
          eq(apiKeyProviders.providerId, providerId)
        )
      );
  } catch (error) {
    console.error(
      `[ProviderPool] Failed to remove provider ${providerId} from pool for API key ${apiKeyId}:`,
      error
    );
    throw new Error('Failed to remove provider from pool');
  }
}

/**
 * Update provider priority in an API key's pool
 */
export async function updateProviderPriority(
  apiKeyId: string,
  providerId: string,
  priority: number
): Promise<void> {
  try {
    await db
      .update(apiKeyProviders)
      .set({ priority })
      .where(
        and(
          eq(apiKeyProviders.apiKeyId, apiKeyId),
          eq(apiKeyProviders.providerId, providerId)
        )
      );
  } catch (error) {
    console.error(
      `[ProviderPool] Failed to update provider ${providerId} priority for API key ${apiKeyId}:`,
      error
    );
    throw new Error('Failed to update provider priority');
  }
}

/**
 * Set active status for a provider in an API key's pool
 */
export async function setProviderActiveStatus(
  apiKeyId: string,
  providerId: string,
  isActive: boolean
): Promise<void> {
  try {
    await db
      .update(apiKeyProviders)
      .set({ isActive })
      .where(
        and(
          eq(apiKeyProviders.apiKeyId, apiKeyId),
          eq(apiKeyProviders.providerId, providerId)
        )
      );
  } catch (error) {
    console.error(
      `[ProviderPool] Failed to set provider ${providerId} active status for API key ${apiKeyId}:`,
      error
    );
    throw new Error('Failed to update provider status');
  }
}

/**
 * Set entire provider pool for an API key
 * Replaces existing pool with new providers
 */
export async function setProviderPool(
  apiKeyId: string,
  providerIds: Array<{ providerId: string; priority?: number }>
): Promise<void> {
  try {
    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Delete existing pool
      await tx.delete(apiKeyProviders).where(eq(apiKeyProviders.apiKeyId, apiKeyId));

      // Insert new pool
      if (providerIds.length > 0) {
        await tx.insert(apiKeyProviders).values(
          providerIds.map((item) => ({
            apiKeyId,
            providerId: item.providerId,
            priority: item.priority || 0,
            isActive: true,
          }))
        );
      }
    });
  } catch (error) {
    console.error(`[ProviderPool] Failed to set provider pool for API key ${apiKeyId}:`, error);
    throw new Error('Failed to set provider pool');
  }
}

/**
 * Get count of API keys using a specific provider
 * Useful for provider deletion validation
 */
export async function getProviderUsageCount(providerId: string): Promise<number> {
  try {
    const result = await db
      .select({
        count: eq(apiKeyProviders.providerId, providerId),
      })
      .from(apiKeyProviders)
      .where(eq(apiKeyProviders.providerId, providerId));

    return result.length;
  } catch (error) {
    console.error(`[ProviderPool] Failed to get usage count for provider ${providerId}:`, error);
    return 0;
  }
}

/**
 * Check if an API key has a specific provider in its pool
 */
export async function hasProviderInPool(
  apiKeyId: string,
  providerId: string
): Promise<boolean> {
  try {
    const result = await db
      .select()
      .from(apiKeyProviders)
      .where(
        and(
          eq(apiKeyProviders.apiKeyId, apiKeyId),
          eq(apiKeyProviders.providerId, providerId)
        )
      )
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error(
      `[ProviderPool] Failed to check if provider ${providerId} is in pool for API key ${apiKeyId}:`,
      error
    );
    return false;
  }
}
