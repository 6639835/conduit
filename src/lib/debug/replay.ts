/**
 * Request Replay & Debugging
 * Replay historical requests, diff comparison, debug mode
 */

import { db } from '@/lib/db';
import { requestLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { kv } from '@vercel/kv';
import { calculateCost as calculateUsageCost } from '@/lib/analytics/cost-calculator';

export interface ReplayRequest {
  id: string;
  originalRequestId: string;
  prompt: string;
  systemPrompt?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  provider: string;
  replayedAt: Date;
  result: {
    success: boolean;
    response?: unknown;
    error?: string;
    latencyMs: number;
  };
}

export interface RequestDiff {
  originalRequestId: string;
  replayRequestId: string;
  differences: {
    prompt: {
      changed: boolean;
      original?: string;
      replayed?: string;
    };
    response: {
      changed: boolean;
      original?: string;
      replayed?: string;
      similarity?: number;
    };
    latency: {
      original: number;
      replayed: number;
      diff: number;
      percentChange: number;
    };
    cost: {
      original: number;
      replayed: number;
      diff: number;
      percentChange: number;
    };
  };
}

/**
 * Get request details for replay
 */
type RequestMetadata = {
  prompt?: string;
  response?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
};

const REPLAY_HISTORY_LIMIT = 50;
const DEBUG_LOG_LIMIT = 100;

async function readKvList<T>(key: string): Promise<T[]> {
  const raw = await kv.get<string>(key);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeKvList<T>(key: string, items: T[], ttlSeconds: number): Promise<void> {
  await kv.set(key, JSON.stringify(items), { ex: ttlSeconds });
}

export async function getRequestForReplay(requestId: string) {
  const [request] = await db
    .select()
    .from(requestLogs)
    .where(eq(requestLogs.id, requestId))
    .limit(1);

  if (!request) {
    throw new Error('Request not found');
  }

  return {
    id: request.id,
    apiKeyId: request.apiKeyId,
    providerId: request.providerId,
    model: request.model || 'claude-sonnet-4',
    endpoint: request.endpoint,
    method: request.method,
    statusCode: request.statusCode,
    latencyMs: request.latencyMs || 0,
    promptTokens: request.promptTokens || 0,
    completionTokens: request.completionTokens || 0,
    costCents: Number(request.cost || 0),
    createdAt: request.createdAt,
    metadata: request.metadata as RequestMetadata | null,
  };
}

/**
 * Replay a historical request
 * This simulates re-running the request with the same parameters
 */
export async function replayRequest(
  requestId: string,
  options: {
    useOriginalProvider?: boolean;
    overrideModel?: string;
    overrideTemperature?: number;
  } = {}
): Promise<ReplayRequest> {
  const originalRequest = await getRequestForReplay(requestId);

  // Extract request details from metadata
  const metadata = originalRequest.metadata || {};
  const prompt = metadata.prompt || 'Original prompt not available';
  const systemPrompt = metadata.systemPrompt;
  const temperature = options.overrideTemperature || metadata.temperature || 0.7;
  const maxTokens = metadata.maxTokens || 1000;

  const startTime = Date.now();

  try {
    // In production, this would make an actual API call to the provider
    // For now, we simulate the response
    const mockResponse = {
      id: `replay-${Date.now()}`,
      content: 'This is a replayed response (mock)',
      model: options.overrideModel || originalRequest.model,
      usage: {
        promptTokens: originalRequest.promptTokens,
        completionTokens: originalRequest.completionTokens,
        totalTokens: originalRequest.promptTokens + originalRequest.completionTokens,
      },
    };

    const latencyMs = Date.now() - startTime;

    const replayRecord: ReplayRequest = {
      id: `replay-${requestId}-${Date.now()}`,
      originalRequestId: requestId,
      prompt,
      systemPrompt,
      model: options.overrideModel || originalRequest.model,
      temperature,
      maxTokens,
      provider: options.useOriginalProvider ? 'original' : 'default',
      replayedAt: new Date(),
      result: {
        success: true,
        response: mockResponse,
        latencyMs,
      },
    };

    await kv.set(`replay:${replayRecord.id}`, JSON.stringify(replayRecord), { ex: 86400 });
    const historyKey = `replay:history:${originalRequest.apiKeyId}`;
    const history = await readKvList<ReplayRequest>(historyKey);
    history.unshift(replayRecord);
    await writeKvList(historyKey, history.slice(0, REPLAY_HISTORY_LIMIT), 86400);

    return replayRecord;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    const replayRecord: ReplayRequest = {
      id: `replay-${requestId}-${Date.now()}`,
      originalRequestId: requestId,
      prompt,
      systemPrompt,
      model: options.overrideModel || originalRequest.model,
      temperature,
      maxTokens,
      provider: options.useOriginalProvider ? 'original' : 'default',
      replayedAt: new Date(),
      result: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs,
      },
    };

    await kv.set(`replay:${replayRecord.id}`, JSON.stringify(replayRecord), { ex: 86400 });
    const historyKey = `replay:history:${originalRequest.apiKeyId}`;
    const history = await readKvList<ReplayRequest>(historyKey);
    history.unshift(replayRecord);
    await writeKvList(historyKey, history.slice(0, REPLAY_HISTORY_LIMIT), 86400);

    return replayRecord;
  }
}

/**
 * Compare original request with replay
 */
export async function compareRequests(
  originalRequestId: string,
  replayRequestId: string
): Promise<RequestDiff> {
  const originalRequest = await getRequestForReplay(originalRequestId);
  const replayData = await kv.get<string>(`replay:${replayRequestId}`);

  if (!replayData) {
    throw new Error('Replay request not found');
  }

  const replay: ReplayRequest = JSON.parse(replayData);

  const originalMetadata = originalRequest.metadata || {};
  const originalPrompt = originalMetadata.prompt || '';
  const originalResponse = originalMetadata.response || '';

  const replayResultResponse = replay.result.response as
    | { content?: string; usage?: Record<string, unknown> }
    | undefined;

  const replayResponse = replayResultResponse?.content || '';

  // Calculate text similarity (simple Levenshtein-based)
  const responseSimilarity = calculateSimilarity(
    originalResponse.toString(),
    replayResponse.toString()
  );

  const latencyDiff = replay.result.latencyMs - originalRequest.latencyMs;
  const latencyPercentChange =
    originalRequest.latencyMs > 0
      ? (latencyDiff / originalRequest.latencyMs) * 100
      : 0;

  const replayCost = calculateReplayCostCents(
    replay.model,
    replayResultResponse?.usage || {}
  );
  const costDiff = replayCost - originalRequest.costCents;
  const costPercentChange =
    originalRequest.costCents > 0 ? (costDiff / originalRequest.costCents) * 100 : 0;

  return {
    originalRequestId,
    replayRequestId,
    differences: {
      prompt: {
        changed: originalPrompt !== replay.prompt,
        original: originalPrompt,
        replayed: replay.prompt,
      },
      response: {
        changed: responseSimilarity < 0.95,
        original: originalResponse.toString().substring(0, 500),
        replayed: replayResponse.substring(0, 500),
        similarity: responseSimilarity,
      },
      latency: {
        original: originalRequest.latencyMs,
        replayed: replay.result.latencyMs,
        diff: latencyDiff,
        percentChange: latencyPercentChange,
      },
      cost: {
        original: originalRequest.costCents,
        replayed: replayCost,
        diff: costDiff,
        percentChange: costPercentChange,
      },
    },
  };
}

/**
 * Calculate simple text similarity (0-1)
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  const longer = text1.length > text2.length ? text1 : text2;
  const shorter = text1.length > text2.length ? text2 : text1;

  if (longer.length === 0) return 1;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate cost from usage
 */
function calculateReplayCostCents(
  model: string,
  usage: { promptTokens?: number; completionTokens?: number }
): number {
  const promptTokens = usage.promptTokens || 0;
  const completionTokens = usage.completionTokens || 0;

  return calculateUsageCost(model, promptTokens, completionTokens);
}

/**
 * Batch replay requests
 */
export async function batchReplayRequests(
  requestIds: string[],
  options: {
    useOriginalProvider?: boolean;
    overrideModel?: string;
  } = {}
): Promise<ReplayRequest[]> {
  const results: ReplayRequest[] = [];

  for (const requestId of requestIds) {
    try {
      const replay = await replayRequest(requestId, options);
      results.push(replay);

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to replay request ${requestId}:`, error);
    }
  }

  return results;
}

/**
 * Get recent replay history
 */
export async function getReplayHistory(
  apiKeyId: string,
  limit: number = 50
): Promise<ReplayRequest[]> {
  const history = await readKvList<ReplayRequest>(`replay:history:${apiKeyId}`);
  return history.slice(0, limit).map((entry) => ({
    ...entry,
    replayedAt: new Date(entry.replayedAt),
  }));
}

/**
 * Debug mode - enhanced request logging
 */
export interface DebugInfo {
  requestId: string;
  timestamp: Date;
  apiKey: {
    id: string;
    prefix: string;
    rateLimits: Record<string, unknown>;
  };
  provider: {
    id: string;
    name: string;
    endpoint: string;
    region?: string;
  };
  request: {
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    latencyMs: number;
  };
  routing: {
    strategy: string;
    selectedProvider: string;
    alternatives: string[];
  };
  caching: {
    cacheHit: boolean;
    cacheKey?: string;
    similarity?: number;
  };
}

/**
 * Enable debug mode for an API key
 */
export async function enableDebugMode(apiKeyId: string, durationMinutes: number = 60): Promise<void> {
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  await kv.set(`debug:${apiKeyId}`, JSON.stringify({ enabled: true, expiresAt }), {
    ex: durationMinutes * 60,
  });
}

/**
 * Check if debug mode is enabled
 */
export async function isDebugModeEnabled(apiKeyId: string): Promise<boolean> {
  const debugMode = await kv.get<string>(`debug:${apiKeyId}`);
  return !!debugMode;
}

/**
 * Log debug information
 */
export async function logDebugInfo(info: DebugInfo): Promise<void> {
  const key = `debug:logs:${info.apiKey.id}`;
  const logs = await readKvList<DebugInfo>(key);
  logs.unshift(info);
  await writeKvList(key, logs.slice(0, DEBUG_LOG_LIMIT), 3600);
}

/**
 * Get debug requestLogs for an API key
 */
export async function getDebugLogs(
  apiKeyId: string,
  limit: number = 50
): Promise<DebugInfo[]> {
  const logs = await readKvList<DebugInfo>(`debug:logs:${apiKeyId}`);
  return logs.slice(0, limit).map((entry) => ({
    ...entry,
    timestamp: new Date(entry.timestamp),
  }));
}
