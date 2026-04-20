import { db } from './db';
import { responseCache } from './db/schema';
import { eq, lt } from 'drizzle-orm';

export interface CachedResponseEntry {
  response: unknown;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface CacheKeyScope {
  apiKeyId: string;
  providerId?: string;
}

/**
 * Generates a cache key from request data using Web Crypto API
 * @param model - The model name
 * @param requestBody - The request body
 * @param scope - Cache isolation scope
 * @returns Cache key hash
 */
export async function generateCacheKey(
  model: string,
  requestBody: Record<string, unknown>,
  scope?: CacheKeyScope
): Promise<string> {
  // Create a deterministic string from the request (stable key ordering)
  const cacheData = {
    scope: scope || null,
    request: {
      ...requestBody,
      model,
    },
  };

  const dataString = stableStringify(cacheData);
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  const serializedEntries = entries.map(
    ([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`
  );

  return `{${serializedEntries.join(',')}}`;
}

/**
 * Retrieves a cached response
 * @param cacheKey - The cache key
 * @returns Cached response or null
 */
export async function getCachedResponse(
  cacheKey: string
): Promise<unknown | null> {
  const cached = await getCachedResponseEntry(cacheKey);
  return cached?.response ?? null;
}

export async function getCachedResponseEntry(
  cacheKey: string
): Promise<CachedResponseEntry | null> {
  try {
    const [cached] = await db
      .select()
      .from(responseCache)
      .where(eq(responseCache.cacheKey, cacheKey))
      .limit(1);

    if (!cached) {
      return null;
    }

    // Check if cache has expired
    if (new Date() > cached.expiresAt) {
      // Delete expired cache entry
      await db
        .delete(responseCache)
        .where(eq(responseCache.cacheKey, cacheKey));
      return null;
    }

    return {
      response: cached.response,
      model: cached.model,
      tokensInput: cached.tokensInput,
      tokensOutput: cached.tokensOutput,
      createdAt: cached.createdAt,
      expiresAt: cached.expiresAt,
    };
  } catch (error) {
    console.error('Cache retrieval error:', error);
    return null;
  }
}

/**
 * Stores a response in cache
 * @param cacheKey - The cache key
 * @param response - The response to cache
 * @param model - The model name
 * @param tokensInput - Input tokens
 * @param tokensOutput - Output tokens
 * @param ttlSeconds - Time to live in seconds
 */
export async function setCachedResponse(
  cacheKey: string,
  response: unknown,
  model: string,
  tokensInput: number,
  tokensOutput: number,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await db.insert(responseCache).values({
      cacheKey,
      response,
      model,
      tokensInput,
      tokensOutput,
      expiresAt,
    });
  } catch (error) {
    // Ignore duplicate key errors (cache already exists)
    const err = error as { code?: string };
    if (err.code !== '23505') {
      console.error('Cache storage error:', error);
    }
  }
}

/**
 * Clears expired cache entries (should be run periodically)
 */
export async function clearExpiredCache(): Promise<number> {
  try {
    await db
      .delete(responseCache)
      .where(lt(responseCache.expiresAt, new Date()));

    return 0; // Drizzle doesn't return count by default
  } catch (error) {
    console.error('Cache cleanup error:', error);
    return 0;
  }
}

/**
 * Clears all cache entries for a specific model
 * @param model - The model name
 */
export async function clearModelCache(model: string): Promise<void> {
  try {
    await db
      .delete(responseCache)
      .where(eq(responseCache.model, model));
  } catch (error) {
    console.error('Model cache clear error:', error);
  }
}

/**
 * Checks if caching is enabled for a request
 * @param requestBody - The request body
 * @returns true if cacheable
 */
export function isCacheable(requestBody: Record<string, unknown>): boolean {
  // Don't cache streaming requests
  if (requestBody.stream === true) {
    return false;
  }

  // Don't cache if temperature is too high (non-deterministic)
  if (requestBody.temperature && typeof requestBody.temperature === 'number' && requestBody.temperature > 0.3) {
    return false;
  }

  return true;
}
