/**
 * Provider selection strategies for multi-provider support
 * Implements: priority-based, round-robin, least-loaded, cost-optimized
 */

import { kv } from '@vercel/kv';
import type { Provider } from '@/lib/db/schema';
import { getBatchProviderLoads } from './load-tracker';
import { getModelPricing } from '@/lib/analytics/cost-calculator';

export type SelectionStrategyType =
  | 'single'
  | 'priority'
  | 'round-robin'
  | 'least-loaded'
  | 'cost-optimized';

export interface SelectionContext {
  apiKeyId: string;
  providers: Provider[];
  model?: string;
}

export interface ProviderSelectionStrategy {
  select(context: SelectionContext): Promise<Provider[]>;
}

/**
 * Priority-based strategy
 * Selects providers ordered by priority (highest first)
 * Uses provider.priority field
 */
class PriorityStrategy implements ProviderSelectionStrategy {
  async select(context: SelectionContext): Promise<Provider[]> {
    // Already sorted by priority in getProviderPool
    // Just return as-is
    return [...context.providers];
  }
}

/**
 * Round-robin strategy
 * Distributes load evenly across all providers
 * Uses Redis counter to track rotation index per API key
 */
class RoundRobinStrategy implements ProviderSelectionStrategy {
  async select(context: SelectionContext): Promise<Provider[]> {
    const { apiKeyId, providers } = context;

    if (providers.length === 0) {
      return [];
    }

    if (providers.length === 1) {
      return providers;
    }

    try {
      // Get rotation index from Redis
      const key = `rr-index:${apiKeyId}`;

      // Create hash of provider IDs to detect pool changes
      const poolHash = providers.map((p) => p.id).sort().join(',');
      const hashKey = `rr-hash:${apiKeyId}`;

      // Check if pool has changed
      const storedHash = await kv.get<string>(hashKey);

      if (storedHash !== poolHash) {
        // Pool changed, reset index
        await kv.set(key, 0);
        await kv.set(hashKey, poolHash);
        await kv.expire(key, 86400); // 24 hours
        await kv.expire(hashKey, 86400);
      }

      // Atomically increment and get index
      const index = await kv.incr(key);
      await kv.expire(key, 86400); // Reset TTL on each use

      // Calculate current provider index (modulo wrap-around)
      const currentIndex = (index - 1) % providers.length;

      // Return providers rotated so current provider is first
      const rotated = [
        ...providers.slice(currentIndex),
        ...providers.slice(0, currentIndex),
      ];

      return rotated;
    } catch (error) {
      console.error('[RoundRobinStrategy] Failed to select provider:', error);
      // Fall back to priority order
      return providers;
    }
  }
}

/**
 * Least-loaded strategy
 * Selects provider with fewest active requests
 * Uses load tracking service
 */
class LeastLoadedStrategy implements ProviderSelectionStrategy {
  async select(context: SelectionContext): Promise<Provider[]> {
    const { providers } = context;

    if (providers.length === 0) {
      return [];
    }

    if (providers.length === 1) {
      return providers;
    }

    try {
      // Get load for all providers
      const providerIds = providers.map((p) => p.id);
      const loadMap = await getBatchProviderLoads(providerIds);

      // Sort providers by load (ascending) then by priority (descending)
      const sorted = [...providers].sort((a, b) => {
        const loadA = loadMap.get(a.id) || 0;
        const loadB = loadMap.get(b.id) || 0;

        // First compare by load
        if (loadA !== loadB) {
          return loadA - loadB; // Lower load first
        }

        // If load is equal, use priority
        return (b.priority || 0) - (a.priority || 0); // Higher priority first
      });

      return sorted;
    } catch (error) {
      console.error('[LeastLoadedStrategy] Failed to select provider:', error);
      // Fall back to priority order
      return providers;
    }
  }
}

/**
 * Cost-optimized strategy
 * Selects cheapest provider based on cost multiplier
 * Uses provider.costMultiplier and model pricing
 */
class CostOptimizedStrategy implements ProviderSelectionStrategy {
  async select(context: SelectionContext): Promise<Provider[]> {
    const { providers, model } = context;

    if (providers.length === 0) {
      return [];
    }

    if (providers.length === 1) {
      return providers;
    }

    try {
      // Get base pricing for model
      const modelPricing = model ? getModelPricing(model) : getModelPricing('default');
      const baseCost =
        modelPricing.inputPricePerMillion + modelPricing.outputPricePerMillion;

      // Calculate effective cost for each provider
      const providersWithCost = providers.map((provider) => {
        const multiplier = parseFloat(provider.costMultiplier || '1.00');
        const effectiveCost = baseCost * multiplier;

        return {
          provider,
          effectiveCost,
          multiplier,
        };
      });

      // Sort by cost (ascending) then by priority (descending)
      const sorted = providersWithCost.sort((a, b) => {
        // First compare by cost
        if (a.effectiveCost !== b.effectiveCost) {
          return a.effectiveCost - b.effectiveCost; // Lower cost first
        }

        // If cost is equal, use priority
        return (b.provider.priority || 0) - (a.provider.priority || 0); // Higher priority first
      });

      return sorted.map((item) => item.provider);
    } catch (error) {
      console.error('[CostOptimizedStrategy] Failed to select provider:', error);
      // Fall back to priority order
      return providers;
    }
  }
}

/**
 * Strategy registry
 */
const strategies: Record<SelectionStrategyType, ProviderSelectionStrategy> = {
  single: new PriorityStrategy(), // Single provider uses priority (will be first in pool)
  priority: new PriorityStrategy(),
  'round-robin': new RoundRobinStrategy(),
  'least-loaded': new LeastLoadedStrategy(),
  'cost-optimized': new CostOptimizedStrategy(),
};

/**
 * Get strategy instance by type
 */
export function getStrategy(type: SelectionStrategyType): ProviderSelectionStrategy {
  const strategy = strategies[type];

  if (!strategy) {
    console.warn(`[SelectionStrategy] Unknown strategy type: ${type}, falling back to priority`);
    return strategies.priority;
  }

  return strategy;
}

/**
 * Select providers using specified strategy
 * Main entry point for provider selection
 */
export async function selectProviders(
  strategyType: SelectionStrategyType,
  context: SelectionContext
): Promise<Provider[]> {
  const strategy = getStrategy(strategyType);
  return await strategy.select(context);
}

/**
 * Validate strategy type
 */
export function isValidStrategy(type: string): type is SelectionStrategyType {
  return type in strategies;
}

/**
 * Get all available strategy types
 */
export function getAvailableStrategies(): SelectionStrategyType[] {
  return Object.keys(strategies) as SelectionStrategyType[];
}
