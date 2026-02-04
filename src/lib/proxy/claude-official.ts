/**
 * Claude Official API proxy implementation
 * Forwards requests to api.anthropic.com with target API key
 */

import { decryptApiKey } from '@/lib/utils/crypto';
import type { ApiKey, Provider } from '@/lib/db/schema';

const CLAUDE_API_BASE = 'https://api.anthropic.com';

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
 * Forward request to Claude API (Official, Bedrock, or Custom)
 * Preserves all headers, query params, and body
 * Injects provider credential and removes gateway-only auth headers
 */
export async function proxyToClaudeOfficial(options: ProxyOptions): Promise<Response> {
  const { provider, path, method, headers, body } = options;

  try {
    // Decrypt provider API key
    const targetApiKey = await decryptApiKey(provider.apiKey);

    // Build full URL using provider's endpoint
    const baseUrl = provider.endpoint || CLAUDE_API_BASE;
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

    // Set target API key (Anthropic uses x-api-key)
    proxyHeaders.set('x-api-key', targetApiKey);

    // Set anthropic-version header if not present (updated to latest stable version)
    if (!proxyHeaders.has('anthropic-version')) {
      proxyHeaders.set('anthropic-version', '2023-06-01'); // Can be updated to newer versions as needed
    }

    // Set content-type if body present
    if (body && !proxyHeaders.has('content-type')) {
      proxyHeaders.set('content-type', 'application/json');
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      // Make request to Claude API with timeout
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
    console.error('Error proxying to Claude API:', error);
    throw error;
  }
}

/**
 * Validate that the path is a valid Claude API endpoint
 * Returns true if path is allowed, false otherwise
 */
export function isValidClaudePath(path: string): boolean {
  // Whitelist of allowed path prefixes
  // Expanded to include more Anthropic API endpoints
  const allowedPaths = [
    '/v1/messages',      // Main chat completions endpoint
    '/v1/complete',      // Legacy completions endpoint
    '/v1/models',        // List available models
    '/v1/count_tokens',  // Token counting endpoint
  ];

  return allowedPaths.some((allowedPath) => path.startsWith(allowedPath));
}

/**
 * Clean response headers before forwarding to client
 * Removes hop-by-hop headers and server-specific headers
 */
export function cleanResponseHeaders(headers: Headers): Headers {
  const cleanHeaders = new Headers(headers);

  // Remove hop-by-hop headers
  const hopByHopHeaders = [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ];

  hopByHopHeaders.forEach((header) => {
    cleanHeaders.delete(header);
  });

  return cleanHeaders;
}
