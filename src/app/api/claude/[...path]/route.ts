import { NextRequest, NextResponse } from 'next/server';
import { validateApiKeyFromHeaders } from '@/lib/auth/api-key';
import { proxyToClaudeOfficial, isValidClaudePath, cleanResponseHeaders } from '@/lib/proxy/claude-official';
import { createStreamingResponse, isStreamingResponse, parseNonStreamingResponse } from '@/lib/proxy/streaming';
import { checkRateLimit, addRateLimitHeaders, createRateLimitResponse } from '@/lib/rate-limit';
import { checkQuota, createQuotaExceededResponse, incrementTokenUsage } from '@/lib/rate-limit/quota-checker';
import { logUsageAsync, extractRequestMetadata } from '@/lib/analytics/logger';
import { db } from '@/lib/db';
import { providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '@/types';
import { validateIpAccess, getClientIp } from '@/lib/security/ip-security';
import { verifyHmacSignature, extractHmacHeaders } from '@/lib/security/hmac';
import { isKeyExpired } from '@/lib/key-rotation';
import { getCachedResponse, setCachedResponse, generateCacheKey, isCacheable } from '@/lib/cache';
import { transformResponse, type TransformationRule } from '@/lib/proxy/response-transformer';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';

// Configure edge runtime for global distribution
export const runtime = 'edge';

// Validation schema for API key scopes
const scopesSchema = z.object({
  models: z.array(z.string()).optional(),
  endpoints: z.array(z.string()).optional(),
}).nullable();

/**
 * Cached provider fetcher to reduce database queries
 * Providers are static data that rarely change
 */
const getCachedProvider = unstable_cache(
  async (providerId: string) => {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);
    return provider;
  },
  ['provider-by-id'],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ['providers'],
  }
);

/**
 * Catch-all proxy route: /api/claude/[...path]
 * Forwards ALL Claude API requests transparently
 *
 * Flow:
 * 1. Extract and validate API key from Authorization header
 * 2. Check rate limits
 * 3. Check quotas
 * 4. Forward request to Claude API with target key
 * 5. Stream response back to client
 * 6. Log usage asynchronously
 */
async function handleRequest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const startTime = Date.now();

  try {
    // Extract path from params
    const { path: pathSegments } = await context.params;
    const path = `/${pathSegments.join('/')}`;

    // Extract request metadata for logging
    const requestMetadata = extractRequestMetadata(request.headers);

    // Validate path
    if (!isValidClaudePath(path)) {
      return NextResponse.json(
        {
          error: {
            type: 'invalid_request_error',
            message: `Invalid API path: ${path}`,
          },
        },
        { status: 400 }
      );
    }

    // Validate API key
    const apiKey = await validateApiKeyFromHeaders(request.headers);
    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            type: 'authentication_error',
            message: 'Invalid or missing API key',
          },
        },
        { status: 401 }
      );
    }

    // Check if key has expired
    if (isKeyExpired(apiKey.expiresAt)) {
      return NextResponse.json(
        {
          error: {
            type: 'authentication_error',
            message: 'API key has expired',
          },
        },
        { status: 401 }
      );
    }

    // IP security check
    const clientIp = getClientIp(request);
    const ipCheck = validateIpAccess(clientIp, apiKey);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            type: 'permission_error',
            message: ipCheck.reason || 'IP address not authorized',
          },
        },
        { status: 403 }
      );
    }

    // Parse request body if present (needed for HMAC and scope validation)
    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        try {
          body = await request.json();
        } catch (error) {
          console.error('Failed to parse request body as JSON:', error);
          return NextResponse.json(
            {
              error: {
                type: 'invalid_request_error',
                message: 'Invalid JSON in request body',
              },
            },
            { status: 400 }
          );
        }
      }
    }

    // HMAC signature verification
    if (apiKey.hmacEnabled && apiKey.hmacSecret) {
      const { signature, timestamp } = extractHmacHeaders(request);

      if (!signature || !timestamp) {
        return NextResponse.json(
          {
            error: {
              type: 'authentication_error',
              message: 'Missing HMAC signature or timestamp headers',
            },
          },
          { status: 401 }
        );
      }

      const requestBody = body ? JSON.stringify(body) : '';
      const hmacResult = await verifyHmacSignature(
        apiKey.hmacSecret,
        signature,
        request.method,
        path,
        timestamp,
        requestBody
      );

      if (!hmacResult.valid) {
        return NextResponse.json(
          {
            error: {
              type: 'authentication_error',
              message: hmacResult.reason || 'Invalid HMAC signature',
            },
          },
          { status: 401 }
        );
      }
    }

    // Scope validation (model and endpoint restrictions)
    if (apiKey.scopes) {
      // Validate scopes structure at runtime
      const scopesValidation = scopesSchema.safeParse(apiKey.scopes);
      if (!scopesValidation.success) {
        console.error('Invalid scopes format for API key:', apiKey.id);
        return NextResponse.json(
          {
            error: {
              type: 'configuration_error',
              message: 'Invalid API key scopes configuration',
            },
          },
          { status: 500 }
        );
      }

      const scopes = scopesValidation.data;

      // Check endpoint restriction
      if (scopes && scopes.endpoints && scopes.endpoints.length > 0) {
        const allowed = scopes.endpoints.some((endpoint) => path.startsWith(endpoint));
        if (!allowed) {
          return NextResponse.json(
            {
              error: {
                type: 'permission_error',
                message: `API key not authorized for endpoint: ${path}`,
              },
            },
            { status: 403 }
          );
        }
      }

      // Check model restriction (will be verified after parsing request body)
      if (body && scopes && scopes.models && scopes.models.length > 0) {
        const requestedModel = body.model;
        if (requestedModel && !scopes.models.includes(requestedModel)) {
          return NextResponse.json(
            {
              error: {
                type: 'permission_error',
                message: `API key not authorized for model: ${requestedModel}`,
              },
            },
            { status: 403 }
          );
        }
      }
    }

    // Fetch provider for this API key (with caching)
    const provider = await getCachedProvider(apiKey.providerId);

    if (!provider) {
      return NextResponse.json(
        {
          error: {
            type: 'configuration_error',
            message: 'Provider not found for this API key',
          },
        },
        { status: 500 }
      );
    }

    if (!provider.isActive) {
      return NextResponse.json(
        {
          error: {
            type: 'configuration_error',
            message: 'Provider is not active',
          },
        },
        { status: 503 }
      );
    }

    // Check rate limits
    const rateLimitResult = await checkRateLimit(apiKey);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    // Check quotas
    const quotaResult = await checkQuota(apiKey);
    if (!quotaResult.allowed) {
      return createQuotaExceededResponse(quotaResult);
    }

    // Check cache for non-streaming requests
    if (body && provider.cacheEnabled && isCacheable(body)) {
      const cacheKey = await generateCacheKey(body.model || 'claude-3-5-sonnet-20241022', body);
      const cachedResponse = await getCachedResponse(cacheKey);

      if (cachedResponse) {
        console.log('Cache hit for request');

        // Return cached response with cache headers
        const headers = new Headers();
        headers.set('X-Cache', 'HIT');
        headers.set('Content-Type', 'application/json');
        addRateLimitHeaders(headers, rateLimitResult);

        return NextResponse.json(cachedResponse, {
          status: 200,
          headers,
        });
      }
    }

    // Forward request to Claude API
    const upstreamResponse = await proxyToClaudeOfficial({
      apiKey,
      provider,
      path,
      method: request.method,
      headers: request.headers,
      body,
    });

    // Calculate latency
    const latencyMs = Date.now() - startTime;

    // Handle streaming response
    if (isStreamingResponse(upstreamResponse)) {
      // Create streaming proxy with usage tracking
      const streamResponse = await createStreamingResponse(
        upstreamResponse,
        async (usageData) => {
          // Increment token usage for quota tracking (await to ensure it completes)
          await incrementTokenUsage(apiKey.id, usageData.tokensInput, usageData.tokensOutput);

          // Log usage to database
          logUsageAsync({
            apiKeyId: apiKey.id,
            method: request.method,
            path,
            model: usageData.model,
            tokensInput: usageData.tokensInput,
            tokensOutput: usageData.tokensOutput,
            latencyMs,
            statusCode: upstreamResponse.status,
            ...requestMetadata,
          });
        }
      );

      // Clean headers and add rate limit info
      const headers = cleanResponseHeaders(streamResponse.headers);
      addRateLimitHeaders(headers, rateLimitResult);

      return new Response(streamResponse.body, {
        status: streamResponse.status,
        statusText: streamResponse.statusText,
        headers,
      });
    }

    // Handle non-streaming response
    const { body: responseBody, usageData } = await parseNonStreamingResponse(upstreamResponse);

    if (usageData) {
      // Increment token usage for quota tracking (await to ensure it completes)
      await incrementTokenUsage(apiKey.id, usageData.tokensInput, usageData.tokensOutput);

      // Log usage to database
      logUsageAsync({
        apiKeyId: apiKey.id,
        method: request.method,
        path,
        model: usageData.model,
        tokensInput: usageData.tokensInput,
        tokensOutput: usageData.tokensOutput,
        latencyMs,
        statusCode: upstreamResponse.status,
        ...requestMetadata,
      });

      // Cache successful responses if caching is enabled
      if (
        body &&
        provider.cacheEnabled &&
        isCacheable(body) &&
        upstreamResponse.status === 200
      ) {
        const cacheKey = await generateCacheKey(usageData.model, body);
        const ttl = provider.cacheTtlSeconds || 300;

        // Store in cache (don't await - fire and forget)
        setCachedResponse(
          cacheKey,
          responseBody,
          usageData.model,
          usageData.tokensInput,
          usageData.tokensOutput,
          ttl
        ).catch((err) => console.error('Cache storage error:', err));
      }
    }

    // Clean headers and add rate limit info
    const headers = cleanResponseHeaders(upstreamResponse.headers);
    headers.set('X-Cache', 'MISS');
    addRateLimitHeaders(headers, rateLimitResult);

    // Apply response transformations if configured
    let finalBody = responseBody;
    let finalHeaders = headers;
    let finalStatus = upstreamResponse.status;

    if (apiKey.transformationRules && Array.isArray(apiKey.transformationRules)) {
      try {
        const transformableResponse = {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText || '',
          headers: Object.fromEntries(headers.entries()),
          body: responseBody,
        };

        const transformed = await transformResponse(
          transformableResponse,
          apiKey.transformationRules as TransformationRule[],
          {
            model: usageData?.model,
            endpoint: path,
          }
        );

        finalBody = transformed.body;
        finalStatus = transformed.status;

        // Apply transformed headers
        finalHeaders = new Headers();
        for (const [key, value] of Object.entries(transformed.headers)) {
          finalHeaders.set(key, value);
        }
      } catch (transformError) {
        console.error('Response transformation error:', transformError);
        // Continue with untransformed response
      }
    }

    return NextResponse.json(finalBody, {
      status: finalStatus,
      statusText: upstreamResponse.statusText,
      headers: finalHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);

    // Return appropriate error response
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          error: {
            type: 'authentication_error',
            message: error.message,
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: {
          type: 'api_error',
          message: 'Internal proxy error',
        },
      },
      { status: 500 }
    );
  }
}

// Export handlers for all HTTP methods
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;
