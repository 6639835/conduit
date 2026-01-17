import { db } from '../db';
import { providers, type Provider as ProviderSchema, type ApiKey } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { decrypt } from '../utils/crypto';
import { proxyToClaudeOfficial } from './claude-official';
import { proxyToOpenAI } from './openai';
import { proxyToGemini } from './gemini';
import { incrementProviderLoad, decrementProviderLoad } from './load-tracker';

export interface Provider {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  priority: number;
  maxRetries: number;
  failoverEnabled: boolean;
  isActive: boolean;
}

/**
 * Gets available providers sorted by priority
 * @returns Array of active providers
 */
export async function getAvailableProviders(): Promise<Provider[]> {
  const results = await db
    .select()
    .from(providers)
    .where(
      and(
        eq(providers.isActive, true),
        eq(providers.status, 'healthy')
      )
    )
    .orderBy(desc(providers.priority));

  return Promise.all(
    results.map(async (p) => ({
      id: p.id,
      name: p.name,
      endpoint: p.endpoint,
      apiKey: await decrypt(p.apiKey),
      priority: p.priority || 0,
      maxRetries: p.maxRetries || 3,
      failoverEnabled: p.failoverEnabled ?? true,
      isActive: p.isActive,
    }))
  );
}

/**
 * Calculates backoff delay for retries (exponential backoff with jitter)
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = 1000
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter (random 0-25% of delay)
  const jitter = Math.random() * 0.25 * exponentialDelay;

  // Cap at 30 seconds
  return Math.min(exponentialDelay + jitter, 30000);
}

/**
 * Sleeps for a specified duration
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if an error is retryable
 * @param error - The error to check
 * @param statusCode - HTTP status code if available
 * @returns true if retryable
 */
export function isRetryableError(
  error: Error & { name?: string; code?: string; status?: number; statusCode?: number },
  statusCode?: number
): boolean {
  // Retry on network errors
  if (error.name === 'FetchError' || error.code === 'ECONNREFUSED') {
    return true;
  }

  // Retry on specific HTTP status codes
  if (statusCode) {
    // 429 Too Many Requests
    // 500 Internal Server Error
    // 502 Bad Gateway
    // 503 Service Unavailable
    // 504 Gateway Timeout
    const retryableStatuses = [429, 500, 502, 503, 504];
    return retryableStatuses.includes(statusCode);
  }

  return false;
}

/**
 * Executes a request with retry logic
 * @param fn - Function to execute
 * @param maxRetries - Maximum retry attempts
 * @param onRetry - Callback on retry
 * @returns Result of function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error as Error & { status?: number; statusCode?: number; name?: string; code?: string };
      lastError = err;

      const statusCode = err.status || err.statusCode;
      const isRetryable = isRetryableError(err, statusCode);

      // Don't retry if not retryable or last attempt
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Call retry callback
      if (onRetry) {
        onRetry(attempt, err);
      }

      // Wait before retrying
      const delay = calculateBackoffDelay(attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Executes a request with failover support
 * @param providers - List of providers to try
 * @param requestFn - Function that takes a provider and returns a promise
 * @returns Result of successful request
 */
export async function withFailover<T>(
  providers: Provider[],
  requestFn: (provider: Provider) => Promise<T>
): Promise<T> {
  if (providers.length === 0) {
    throw new Error('No providers available');
  }

  let lastError: Error | undefined;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];

    try {
      // Try the request with retry logic
      return await withRetry(
        () => requestFn(provider),
        provider.maxRetries,
        (attempt, error) => {
          console.log(
            `Retry attempt ${attempt + 1} for provider ${provider.name}:`,
            error.message
          );
        }
      );
    } catch (error) {
      const err = error as Error;
      lastError = err;
      console.error(
        `Provider ${provider.name} failed:`,
        err.message
      );

      // If this is not the last provider and failover is enabled, try next
      if (i < providers.length - 1 && provider.failoverEnabled) {
        console.log(
          `Failing over to next provider: ${providers[i + 1].name}`
        );
        continue;
      }

      // If failover is disabled or this is the last provider, throw error
      throw error;
    }
  }

  throw lastError;
}

/**
 * Makes a proxy request with failover and retry
 * @param providers - Available providers
 * @param path - Request path
 * @param method - HTTP method
 * @param body - Request body
 * @param headers - Request headers
 * @returns Response
 */
export async function makeProxyRequest(
  providers: Provider[],
  path: string,
  method: string,
  body: string,
  headers: Record<string, string>
): Promise<Response> {
  return await withFailover(providers, async (provider) => {
    const url = `${provider.endpoint}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        'anthropic-version': headers['anthropic-version'] || '2023-06-01',
        'x-api-key': provider.apiKey,
      },
      body: method !== 'GET' ? body : undefined,
    });

    // Throw error if response is not ok (will trigger retry/failover)
    if (!response.ok) {
      const error = new Error(
        `Provider request failed: ${response.statusText}`
      ) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    return response;
  });
}

/**
 * Makes a proxy request with strategy-selected providers
 * Integrates with load tracking and failover logic
 * @param apiKey - API key making the request
 * @param providers - Strategy-selected providers (ordered by preference)
 * @param path - Request path
 * @param method - HTTP method
 * @param headers - Request headers
 * @param body - Request body
 * @returns Response from successful provider
 */
export async function makeProxyRequestWithStrategy(
  apiKey: ApiKey,
  providers: ProviderSchema[],
  path: string,
  method: string,
  headers: Headers,
  body?: unknown
): Promise<Response> {
  if (providers.length === 0) {
    throw new Error('No providers available');
  }

  let lastError: Error | undefined;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];

    // Track load for least-loaded strategy
    await incrementProviderLoad(provider.id);

    try {
      // Try the request with retry logic
      const response = await withRetry(
        async () => {
          if (provider.type === 'codex' || provider.type === 'openai') {
            return await proxyToOpenAI({
              apiKey,
              provider,
              path,
              method,
              headers,
              body,
            });
          }

          if (provider.type === 'gemini') {
            return await proxyToGemini({
              apiKey,
              provider,
              path,
              method,
              headers,
              body,
            });
          }

          return await proxyToClaudeOfficial({
            apiKey,
            provider,
            path,
            method,
            headers,
            body,
          });
        },
        provider.maxRetries || 3,
        (attempt, error) => {
          console.log(
            `[Failover] Retry attempt ${attempt + 1}/${provider.maxRetries} for provider ${provider.name}:`,
            error.message
          );
        }
      );

      // Success - decrement load and return
      await decrementProviderLoad(provider.id);
      return response;
    } catch (error) {
      // Request failed - decrement load
      await decrementProviderLoad(provider.id);

      const err = error as Error;
      lastError = err;
      console.error(
        `[Failover] Provider ${provider.name} (${provider.id}) failed after retries:`,
        err.message
      );

      // If this is not the last provider and failover is enabled, try next
      if (i < providers.length - 1 && provider.failoverEnabled) {
        console.log(
          `[Failover] Failing over to next provider: ${providers[i + 1].name}`
        );
        continue;
      }

      // If failover is disabled or this is the last provider, throw error
      throw error;
    }
  }

  throw lastError || new Error('All providers failed');
}
