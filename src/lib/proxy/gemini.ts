/**
 * Gemini API proxy implementation
 * Forwards requests to Google Generative Language API with provider credentials
 */

import { decryptApiKey } from '@/lib/utils/crypto';
import type { ApiKey, Provider } from '@/lib/db/schema';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';

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
 * Forward request to Gemini API
 * Preserves headers and body, injects x-goog-api-key
 */
export async function proxyToGemini(options: ProxyOptions): Promise<Response> {
  const { provider, path, method, headers, body } = options;

  try {
    const targetApiKey = await decryptApiKey(provider.apiKey);

    const baseUrl = provider.endpoint || GEMINI_API_BASE;
    const url = `${baseUrl}${path}`;

    const proxyHeaders = new Headers();

    const excludeHeaders = [
      'authorization',
      'host',
      'connection',
      'content-length',
      'x-goog-api-key',
    ];
    headers.forEach((value, key) => {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        proxyHeaders.set(key, value);
      }
    });

    proxyHeaders.set('x-goog-api-key', targetApiKey);

    if (body && !proxyHeaders.has('content-type')) {
      proxyHeaders.set('content-type', 'application/json');
    }

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
    console.error('Error proxying to Gemini API:', error);
    throw error;
  }
}

/**
 * Validate that the path is a valid Gemini API endpoint
 */
export function isValidGeminiPath(path: string): boolean {
  const allowedPrefixes = [
    '/v1beta/models',
    '/v1beta/tunedModels',
    '/v1/models',
    '/v1/tunedModels',
  ];

  return allowedPrefixes.some((allowedPath) => path.startsWith(allowedPath));
}

/**
 * Extract Gemini model name from a path like:
 * /v1beta/models/gemini-1.5-flash:generateContent
 */
export function extractGeminiModelFromPath(path: string): string | null {
  const match = path.match(/\/(models|tunedModels)\/([^/:]+)(?::|\/|$)/);
  return match ? decodeURIComponent(match[2]) : null;
}
