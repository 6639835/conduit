/**
 * Semantic Caching
 * Cache responses based on semantic similarity rather than exact matches
 */

import { kv } from '@vercel/kv';
import crypto from 'crypto';

export interface SemanticCacheEntry {
  key: string;
  prompt: string;
  promptEmbedding: number[];
  response: unknown;
  metadata: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
  };
  hitCount: number;
  lastAccessed: Date;
  expiresAt: Date;
}

export interface SemanticCacheConfig {
  enabled: boolean;
  similarityThreshold: number; // 0-1, higher = more strict
  ttlSeconds: number;
  maxCacheSize: number;
  embeddingModel: 'simple' | 'tfidf'; // In production, use actual embedding models
}

const DEFAULT_CONFIG: SemanticCacheConfig = {
  enabled: true,
  similarityThreshold: 0.85,
  ttlSeconds: 3600, // 1 hour
  maxCacheSize: 10000,
  embeddingModel: 'simple',
};

/**
 * Generate a simple embedding for text
 * In production, use actual embedding models like OpenAI embeddings or sentence-transformers
 */
export function generateSimpleEmbedding(text: string): number[] {
  // Normalize text
  const normalized = text.toLowerCase().trim();

  // Create a 128-dimensional embedding based on character frequencies and bigrams
  const embedding = new Array(128).fill(0);

  // Character frequency features (first 26 dimensions for a-z)
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    if (charCode >= 97 && charCode <= 122) {
      // a-z
      embedding[charCode - 97]++;
    }
  }

  // Bigram features (next 50 dimensions for common bigrams)
  const commonBigrams = [
    'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd',
    'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar',
    'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le',
    've', 'co', 'me', 'de', 'hi', 'ri', 'ro', 'ic', 'ne', 'ea',
    'ra', 'ce', 'li', 'ch', 'ma', 'ta', 'sa', 'si', 'la', 'el',
  ];

  for (let i = 0; i < normalized.length - 1; i++) {
    const bigram = normalized.substring(i, i + 2);
    const index = commonBigrams.indexOf(bigram);
    if (index !== -1) {
      embedding[26 + index]++;
    }
  }

  // Trigram and word length features (remaining dimensions)
  const words = normalized.split(/\s+/);
  embedding[76] = words.length; // word count
  embedding[77] = normalized.length; // character count
  embedding[78] = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1); // avg word length

  // Normalize the embedding to unit length
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Generate cache key from prompt and metadata
 */
export function generateCacheKey(prompt: string, metadata: Record<string, unknown>): string {
  const content = JSON.stringify({ prompt, metadata });
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Store response in semantic cache
 */
export async function setCachedResponse(
  apiKeyId: string,
  prompt: string,
  response: unknown,
  metadata: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
  },
  config: Partial<SemanticCacheConfig> = {}
): Promise<void> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (!fullConfig.enabled) return;

  const cacheKey = `semantic:${apiKeyId}:${generateCacheKey(prompt, metadata)}`;
  const embedding = generateSimpleEmbedding(prompt);

  const entry: SemanticCacheEntry = {
    key: cacheKey,
    prompt,
    promptEmbedding: embedding,
    response,
    metadata,
    hitCount: 0,
    lastAccessed: new Date(),
    expiresAt: new Date(Date.now() + fullConfig.ttlSeconds * 1000),
  };

  await kv.set(cacheKey, JSON.stringify(entry), { ex: fullConfig.ttlSeconds });

  // Also store in the index for semantic search
  const indexKey = `semantic:index:${apiKeyId}`;
  await kv.sadd(indexKey, cacheKey);

  // Trim cache if needed
  const cacheSize = await kv.scard(indexKey);
  if (cacheSize > fullConfig.maxCacheSize) {
    // Remove oldest entries
    const allKeys = await kv.smembers(indexKey);
    const entries: SemanticCacheEntry[] = [];

    for (const key of allKeys as string[]) {
      const data = await kv.get<string>(key);
      if (data) {
        entries.push(JSON.parse(data));
      }
    }

    // Sort by last accessed
    entries.sort(
      (a, b) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
    );

    // Remove oldest 10%
    const toRemove = Math.floor(fullConfig.maxCacheSize * 0.1);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      await kv.del(entries[i].key);
      await kv.srem(indexKey, entries[i].key);
    }
  }
}

/**
 * Find semantically similar cached response
 */
export async function getCachedResponse(
  apiKeyId: string,
  prompt: string,
  metadata: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
  },
  config: Partial<SemanticCacheConfig> = {}
): Promise<{ response: unknown; similarity: number; hitCount: number } | null> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (!fullConfig.enabled) return null;

  const queryEmbedding = generateSimpleEmbedding(prompt);
  const indexKey = `semantic:index:${apiKeyId}`;

  const cacheKeys = (await kv.smembers(indexKey)) as string[];
  if (!cacheKeys || cacheKeys.length === 0) return null;

  let bestMatch: { entry: SemanticCacheEntry; similarity: number } | null = null;

  // Find best matching cached entry
  for (const cacheKey of cacheKeys) {
    const data = await kv.get<string>(cacheKey);
    if (!data) continue;

    const entry: SemanticCacheEntry = JSON.parse(data);

    // Check if metadata matches
    if (
      entry.metadata.model !== metadata.model ||
      Math.abs(entry.metadata.temperature - metadata.temperature) > 0.1 ||
      entry.metadata.systemPrompt !== metadata.systemPrompt
    ) {
      continue;
    }

    // Calculate semantic similarity
    const similarity = cosineSimilarity(queryEmbedding, entry.promptEmbedding);

    if (
      similarity >= fullConfig.similarityThreshold &&
      (!bestMatch || similarity > bestMatch.similarity)
    ) {
      bestMatch = { entry, similarity };
    }
  }

  if (!bestMatch) return null;

  // Update hit count and last accessed
  bestMatch.entry.hitCount++;
  bestMatch.entry.lastAccessed = new Date();
  await kv.set(bestMatch.entry.key, JSON.stringify(bestMatch.entry), {
    ex: fullConfig.ttlSeconds,
  });

  return {
    response: bestMatch.entry.response,
    similarity: bestMatch.similarity,
    hitCount: bestMatch.entry.hitCount,
  };
}

/**
 * Cache warming - pre-populate cache with common queries
 */
export interface CacheWarmingEntry {
  prompt: string;
  systemPrompt?: string;
  metadata: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

export async function warmCache(
  apiKeyId: string,
  entries: CacheWarmingEntry[],
  fetchResponse: (entry: CacheWarmingEntry) => Promise<unknown>
): Promise<{ warmed: number; failed: number }> {
  let warmed = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const response = await fetchResponse(entry);
      await setCachedResponse(apiKeyId, entry.prompt, response, entry.metadata);
      warmed++;
    } catch (error) {
      console.error('Cache warming failed for entry:', entry, error);
      failed++;
    }
  }

  return { warmed, failed };
}

/**
 * Get cache analytics
 */
export interface CacheAnalytics {
  totalEntries: number;
  avgHitCount: number;
  topQueries: Array<{
    prompt: string;
    hitCount: number;
    lastAccessed: Date;
  }>;
  hitRate: number;
  memoryUsage: number;
}

export async function getCacheAnalytics(apiKeyId: string): Promise<CacheAnalytics> {
  const indexKey = `semantic:index:${apiKeyId}`;
  const cacheKeys = (await kv.smembers(indexKey)) as string[];

  const entries: SemanticCacheEntry[] = [];
  for (const key of cacheKeys) {
    const data = await kv.get<string>(key);
    if (data) {
      entries.push(JSON.parse(data));
    }
  }

  const totalHits = entries.reduce((sum, e) => sum + e.hitCount, 0);
  const totalEntries = entries.length;

  // Sort by hit count
  entries.sort((a, b) => b.hitCount - a.hitCount);

  // Estimate memory usage (rough approximation)
  const memoryUsage = entries.reduce((sum, e) => {
    return sum + JSON.stringify(e).length;
  }, 0);

  return {
    totalEntries,
    avgHitCount: totalEntries > 0 ? totalHits / totalEntries : 0,
    topQueries: entries.slice(0, 10).map(e => ({
      prompt: e.prompt.substring(0, 100) + (e.prompt.length > 100 ? '...' : ''),
      hitCount: e.hitCount,
      lastAccessed: e.lastAccessed,
    })),
    hitRate: 0, // This would need to track total requests vs cache hits
    memoryUsage,
  };
}

/**
 * Clear semantic cache for an API key
 */
export async function clearSemanticCache(apiKeyId: string): Promise<number> {
  const indexKey = `semantic:index:${apiKeyId}`;
  const cacheKeys = (await kv.smembers(indexKey)) as string[];

  let cleared = 0;
  for (const key of cacheKeys) {
    await kv.del(key);
    cleared++;
  }

  await kv.del(indexKey);

  return cleared;
}
