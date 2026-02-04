/**
 * OpenAI API proxy implementation (Codex via OpenAI API)
 * Forwards requests to api.openai.com with provider credentials
 */

import { decryptApiKey } from '@/lib/utils/crypto';
import type { ApiKey, Provider } from '@/lib/db/schema';

const OPENAI_API_BASE = 'https://api.openai.com';

// Timeout for upstream API requests (60 seconds)
const UPSTREAM_TIMEOUT_MS = 60000;

export interface ProxyOptions {
  apiKey: ApiKey;
  provider: Provider;
  path: string;
  method: string;
  headers: Headers;
  body?: unknown;
}

/**
 * Forward request to OpenAI API
 * Preserves all headers, query params, and body
 * Replaces Authorization header with provider credential
 */
export async function proxyToOpenAI(options: ProxyOptions): Promise<Response> {
  const { provider, path, method, headers, body } = options;

  try {
    // Decrypt provider credential (API key or OAuth access token)
    const targetToken = await decryptApiKey(provider.apiKey);

    // Build full URL using provider's endpoint
    const baseUrl = provider.endpoint || OPENAI_API_BASE;
    const url = `${baseUrl}${path}`;

    // Create new headers object (clone and modify)
    const proxyHeaders = new Headers();

    // Copy headers from original request, removing gateway-only and hop-by-hop headers
    const excludeHeaders = [
      'authorization',
      'x-api-key',
      'x-totp-code',
      'x-signature',
      'x-timestamp',
      'host',
      'connection',
      'content-length',
    ];
    headers.forEach((value, key) => {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        proxyHeaders.set(key, value);
      }
    });

    // Set target token
    proxyHeaders.set('Authorization', `Bearer ${targetToken}`);

    // Set content-type if body present
    if (body && !proxyHeaders.has('content-type')) {
      proxyHeaders.set('content-type', 'application/json');
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers: proxyHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Upstream API request timed out after ${UPSTREAM_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error proxying to OpenAI API:', error);
    throw error;
  }
}

/**
 * Validate that the path is a valid OpenAI API endpoint
 */
export function isValidOpenAIPath(path: string): boolean {
  const allowedPaths = [
    '/v1/responses',        // Responses API
    '/v1/chat/completions', // Chat Completions (legacy)
    '/v1/models',           // List models
  ];

  return allowedPaths.some((allowedPath) => path.startsWith(allowedPath));
}
