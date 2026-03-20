/**
 * Usage logging system
 * Logs all API requests to the database for analytics
 */

import { db } from '@/lib/db';
import { requestLogs, usageLogs } from '@/lib/db/schema';
import { calculateCost } from './cost-calculator';
import { shouldTrustProxyHeaders } from '@/lib/security/trust-proxy';

export interface LogUsageParams {
  apiKeyId: string;
  method: string;
  path: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  statusCode: number;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
}

export type RequestProviderFamily = 'claude' | 'openai' | 'gemini';

export interface LogProxyRequestParams extends LogUsageParams {
  providerId?: string | null;
  providerFamily: RequestProviderFamily;
  requestBody?: unknown;
  responseBody?: unknown;
  responseText?: string;
  streaming?: boolean;
  cacheHit?: boolean;
}

type RequestLogMetadata = {
  prompt?: string;
  response?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  path?: string;
  providerFamily?: RequestProviderFamily;
  streaming?: boolean;
  cacheHit?: boolean;
  ipAddress?: string;
  country?: string;
  userAgent?: string;
};

const TEXT_PREVIEW_LIMIT = 8000;

function truncateText(value: string | undefined, maxLength: number = TEXT_PREVIEW_LIMIT): string | undefined {
  if (!value) return undefined;

  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength)}...`;
}

function appendTexts(parts: string[], value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) parts.push(trimmed);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendTexts(parts, item);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.text === 'string') {
    const trimmed = record.text.trim();
    if (trimmed) parts.push(trimmed);
  }

  if (typeof record.output_text === 'string') {
    const trimmed = record.output_text.trim();
    if (trimmed) parts.push(trimmed);
  }

  if ('content' in record) {
    appendTexts(parts, record.content);
  }

  if ('parts' in record) {
    appendTexts(parts, record.parts);
  }

  if ('message' in record) {
    appendTexts(parts, record.message);
  }

  if ('delta' in record) {
    appendTexts(parts, record.delta);
  }

  if ('output' in record) {
    appendTexts(parts, record.output);
  }
}

function joinTexts(value: unknown): string | undefined {
  const parts: string[] = [];
  appendTexts(parts, value);
  return truncateText(parts.join('\n\n'));
}

function extractClaudePrompt(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  return joinTexts((body as { messages?: unknown }).messages);
}

function extractClaudeSystemPrompt(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  return joinTexts((body as { system?: unknown }).system);
}

function extractClaudeResponse(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  return joinTexts((body as { content?: unknown }).content);
}

function extractOpenAIPrompt(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;

  const record = body as {
    input?: unknown;
    messages?: unknown;
  };

  return joinTexts(record.input) || joinTexts(record.messages);
}

function extractOpenAISystemPrompt(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;

  const record = body as {
    instructions?: unknown;
    messages?: Array<{ role?: string; content?: unknown }>;
  };

  if (record.instructions) {
    return joinTexts(record.instructions);
  }

  const systemMessages = Array.isArray(record.messages)
    ? record.messages.filter((message) => message?.role === 'system').map((message) => message.content)
    : [];

  return joinTexts(systemMessages);
}

function extractOpenAIResponse(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;

  const record = body as {
    output_text?: string;
    output?: unknown;
    choices?: unknown;
    content?: unknown;
  };

  return truncateText(record.output_text)
    || joinTexts(record.output)
    || joinTexts(record.choices)
    || joinTexts(record.content);
}

function extractGeminiPrompt(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  return joinTexts((body as { contents?: unknown }).contents);
}

function extractGeminiSystemPrompt(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  return joinTexts((body as { systemInstruction?: unknown }).systemInstruction);
}

function extractGeminiResponse(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  return joinTexts((body as { candidates?: unknown }).candidates);
}

function extractTemperature(providerFamily: RequestProviderFamily, body: unknown): number | undefined {
  if (!body || typeof body !== 'object') return undefined;

  if (providerFamily === 'gemini') {
    const generationConfig = (body as { generationConfig?: { temperature?: unknown } }).generationConfig;
    return typeof generationConfig?.temperature === 'number' ? generationConfig.temperature : undefined;
  }

  const temperature = (body as { temperature?: unknown }).temperature;
  return typeof temperature === 'number' ? temperature : undefined;
}

function extractMaxTokens(providerFamily: RequestProviderFamily, body: unknown): number | undefined {
  if (!body || typeof body !== 'object') return undefined;

  if (providerFamily === 'claude') {
    const maxTokens = (body as { max_tokens?: unknown }).max_tokens;
    return typeof maxTokens === 'number' ? maxTokens : undefined;
  }

  if (providerFamily === 'openai') {
    const record = body as { max_output_tokens?: unknown; max_tokens?: unknown };
    if (typeof record.max_output_tokens === 'number') return record.max_output_tokens;
    if (typeof record.max_tokens === 'number') return record.max_tokens;
    return undefined;
  }

  const generationConfig = (body as { generationConfig?: { maxOutputTokens?: unknown } }).generationConfig;
  return typeof generationConfig?.maxOutputTokens === 'number' ? generationConfig.maxOutputTokens : undefined;
}

function extractErrorMessage(responseBody: unknown): string | undefined {
  if (!responseBody || typeof responseBody !== 'object') return undefined;

  const record = responseBody as {
    error?: unknown;
    message?: unknown;
  };

  if (typeof record.message === 'string') {
    return truncateText(record.message, 1000);
  }

  if (typeof record.error === 'string') {
    return truncateText(record.error, 1000);
  }

  if (record.error && typeof record.error === 'object') {
    const nestedMessage = (record.error as { message?: unknown }).message;
    if (typeof nestedMessage === 'string') {
      return truncateText(nestedMessage, 1000);
    }
  }

  return undefined;
}

function buildRequestLogMetadata(params: LogProxyRequestParams): RequestLogMetadata | null {
  const { providerFamily, requestBody, responseBody, responseText } = params;

  const prompt = providerFamily === 'claude'
    ? extractClaudePrompt(requestBody)
    : providerFamily === 'openai'
      ? extractOpenAIPrompt(requestBody)
      : extractGeminiPrompt(requestBody);

  const systemPrompt = providerFamily === 'claude'
    ? extractClaudeSystemPrompt(requestBody)
    : providerFamily === 'openai'
      ? extractOpenAISystemPrompt(requestBody)
      : extractGeminiSystemPrompt(requestBody);

  const extractedResponse = providerFamily === 'claude'
    ? extractClaudeResponse(responseBody)
    : providerFamily === 'openai'
      ? extractOpenAIResponse(responseBody)
      : extractGeminiResponse(responseBody);

  const response = truncateText(responseText) || extractedResponse;
  const temperature = extractTemperature(providerFamily, requestBody);
  const maxTokens = extractMaxTokens(providerFamily, requestBody);

  const metadata: RequestLogMetadata = {
    prompt,
    response,
    systemPrompt,
    temperature,
    maxTokens,
    path: params.path,
    providerFamily,
    streaming: params.streaming || undefined,
    cacheHit: params.cacheHit || undefined,
    ipAddress: params.ipAddress,
    country: params.country,
    userAgent: params.userAgent,
  };

  return Object.values(metadata).some((value) => value !== undefined) ? metadata : null;
}

/**
 * Log usage to database (async, non-blocking)
 * Errors are logged but don't fail the request
 */
export async function logUsage(params: LogUsageParams): Promise<void> {
  try {
    // Validate token counts (must be non-negative integers)
    const tokensInput = Math.max(0, Math.floor(params.tokensInput || 0));
    const tokensOutput = Math.max(0, Math.floor(params.tokensOutput || 0));

    if (isNaN(tokensInput) || isNaN(tokensOutput)) {
      console.error('Invalid token counts:', { tokensInput: params.tokensInput, tokensOutput: params.tokensOutput });
      return;
    }

    // Calculate cost
    const costUsd = calculateCost(params.model, tokensInput, tokensOutput);

    // Insert into database
    await db.insert(usageLogs).values({
      apiKeyId: params.apiKeyId,
      method: params.method,
      path: params.path,
      model: params.model,
      tokensInput,
      tokensOutput,
      costUsd,
      latencyMs: params.latencyMs,
      statusCode: params.statusCode,
      errorMessage: params.errorMessage || null,
      userAgent: params.userAgent || null,
      ipAddress: params.ipAddress || null,
      country: params.country || null,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error logging usage:', error);
    // Don't throw - logging failures shouldn't affect user requests
  }
}

/**
 * Log usage asynchronously (fire-and-forget)
 * Use this in API routes to avoid blocking responses
 * Note: In edge runtime, this may not complete if the function terminates early.
 * Consider using context.waitUntil() if available in your edge runtime.
 */
export function logUsageAsync(params: LogUsageParams): Promise<void> {
  // Return the promise so callers can optionally await or use waitUntil()
  return logUsage(params).catch((error) => {
    console.error('Async logging error:', error);
  });
}

/**
 * Log both aggregate usage and detailed request data
 */
export async function logProxyRequest(params: LogProxyRequestParams): Promise<void> {
  try {
    const tokensInput = Math.max(0, Math.floor(params.tokensInput || 0));
    const tokensOutput = Math.max(0, Math.floor(params.tokensOutput || 0));

    if (isNaN(tokensInput) || isNaN(tokensOutput)) {
      console.error('Invalid token counts:', { tokensInput: params.tokensInput, tokensOutput: params.tokensOutput });
      return;
    }

    const costUsd = calculateCost(params.model, tokensInput, tokensOutput);
    const errorMessage = params.errorMessage || extractErrorMessage(params.responseBody) || null;
    const timestamp = new Date();
    const metadata = buildRequestLogMetadata({
      ...params,
      tokensInput,
      tokensOutput,
      errorMessage: errorMessage || undefined,
    });

    await Promise.all([
      db.insert(usageLogs).values({
        apiKeyId: params.apiKeyId,
        method: params.method,
        path: params.path,
        model: params.model,
        tokensInput,
        tokensOutput,
        costUsd,
        latencyMs: params.latencyMs,
        statusCode: params.statusCode,
        errorMessage,
        userAgent: params.userAgent || null,
        ipAddress: params.ipAddress || null,
        country: params.country || null,
        timestamp,
      }),
      db.insert(requestLogs).values({
        apiKeyId: params.apiKeyId,
        providerId: params.providerId || null,
        method: params.method,
        endpoint: params.path,
        model: params.model,
        promptTokens: tokensInput,
        completionTokens: tokensOutput,
        cost: costUsd,
        latencyMs: params.latencyMs,
        statusCode: params.statusCode,
        errorMessage,
        metadata,
        createdAt: timestamp,
      }),
    ]);
  } catch (error) {
    console.error('Error logging proxy request:', error);
  }
}

export function logProxyRequestAsync(params: LogProxyRequestParams): Promise<void> {
  return logProxyRequest(params).catch((error) => {
    console.error('Async proxy logging error:', error);
  });
}

/**
 * Extract request metadata from headers
 */
export function extractRequestMetadata(headers: Headers): {
  userAgent?: string;
  ipAddress?: string;
  country?: string;
} {
  const ipAddress = shouldTrustProxyHeaders()
    ? (headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || headers.get('x-real-ip')?.trim()
        || headers.get('cf-connecting-ip')?.trim()
        || undefined)
    : undefined;

  return {
    userAgent: headers.get('user-agent') || undefined,
    ipAddress,
    country: headers.get('cf-ipcountry') || undefined, // Cloudflare country header
  };
}
