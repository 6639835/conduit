/**
 * Claude Official API proxy implementation
 * Forwards requests to api.anthropic.com with target API key
 */

import { decryptApiKey } from '@/lib/utils/crypto';
import type { ApiKey, Provider } from '@/lib/db/schema';

const CLAUDE_API_BASE = 'https://api.anthropic.com';

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
 * Replaces Authorization header with provider's API key
 */
export async function proxyToClaudeOfficial(options: ProxyOptions): Promise<Response> {
  const { apiKey, provider, path, method, headers, body } = options;

  try {
    // Decrypt provider API key
    const targetApiKey = await decryptApiKey(provider.apiKey);

    // Build full URL using provider's endpoint
    const baseUrl = provider.endpoint || CLAUDE_API_BASE;
    const url = `${baseUrl}${path}`;

    // Create new headers object (clone and modify)
    const proxyHeaders = new Headers();

    // Copy headers from original request (except Authorization and Host)
    const excludeHeaders = ['authorization', 'host', 'connection', 'content-length'];
    headers.forEach((value, key) => {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        proxyHeaders.set(key, value);
      }
    });

    // Set target API key
    proxyHeaders.set('Authorization', `Bearer ${targetApiKey}`);

    // Set anthropic-version header if not present
    if (!proxyHeaders.has('anthropic-version')) {
      proxyHeaders.set('anthropic-version', '2023-06-01');
    }

    // Set content-type if body present
    if (body && !proxyHeaders.has('content-type')) {
      proxyHeaders.set('content-type', 'application/json');
    }

    // Make request to Claude API
    const response = await fetch(url, {
      method,
      headers: proxyHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    return response;
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
  const allowedPaths = [
    '/v1/messages',
    '/v1/complete',
    '/v1/models',
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
