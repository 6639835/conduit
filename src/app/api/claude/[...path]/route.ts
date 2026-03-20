import { NextRequest, NextResponse } from 'next/server';
import { validateApiKeyFromHeaders } from '@/lib/auth/api-key';
import { isValidClaudePath, cleanResponseHeaders } from '@/lib/proxy/claude-official';
import { createStreamingResponse, isStreamingResponse, parseNonStreamingResponse } from '@/lib/proxy/streaming';
import { checkRateLimit, addRateLimitHeaders, createRateLimitResponse } from '@/lib/rate-limit';
import { checkQuota, createQuotaExceededResponse, incrementTokenUsage } from '@/lib/rate-limit/quota-checker';
import { logProxyRequestAsync, extractRequestMetadata } from '@/lib/analytics/logger';
import { UnauthorizedError } from '@/types';
import { validateIpAccess, getClientIp } from '@/lib/security/ip-security';
import { verifyHmacSignature, extractHmacHeaders } from '@/lib/security/hmac';
import { isKeyExpired } from '@/lib/key-rotation';
import { getCachedResponseEntry, setCachedResponse, generateCacheKey, isCacheable } from '@/lib/cache';
import { transformResponse, type TransformationRule, coerceTransformationRules } from '@/lib/proxy/response-transformer';
import { z } from 'zod';
import { selectProvidersForRequest } from '@/lib/proxy/provider-selector';
import { makeProxyRequestWithStrategy } from '@/lib/proxy/failover';
import { verifyTOTP } from '@/lib/security/2fa';
import { readJsonBodyIfPresent } from '@/lib/http/request-body';
import { isDebugModeEnabled, logDebugInfo } from '@/lib/debug/replay';

// Configure edge runtime for global distribution
export const runtime = 'edge';

// Validation schema for API key scopes
const scopesSchema = z.object({
  models: z.array(z.string()).optional(),
  endpoints: z.array(z.string()).optional(),
}).nullable();

const DEBUG_HEADER_BLACKLIST = new Set([
  'authorization',
  'x-api-key',
  'x-totp-code',
  'x-signature',
  'x-timestamp',
]);

function getDebugHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (!DEBUG_HEADER_BLACKLIST.has(key.toLowerCase())) {
      sanitized[key] = value;
    }
  });

  return sanitized;
}


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

    // TOTP/2FA verification
    if (apiKey.totpEnabled && apiKey.totpSecret) {
      const totpCode = request.headers.get('x-totp-code');

      if (!totpCode) {
        return NextResponse.json(
          {
            error: {
              type: 'authentication_error',
              message: '2FA is enabled for this API key. Please provide X-TOTP-Code header.',
            },
          },
          { status: 401 }
        );
      }

      const isValid = await verifyTOTP(apiKey.totpSecret, totpCode);

      if (!isValid) {
        return NextResponse.json(
          {
            error: {
              type: 'authentication_error',
              message: 'Invalid TOTP code',
            },
          },
          { status: 401 }
        );
      }
    }

    // Parse request body if present (needed for HMAC and scope validation)
    let body: unknown = null;
    let rawBodyText = '';
    try {
      const parsed = await readJsonBodyIfPresent(request);
      body = parsed.body;
      rawBodyText = parsed.rawBodyText;
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

      const requestBody = rawBodyText;
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

      // Check model restriction (only when request body includes a model)
      if (scopes && scopes.models && scopes.models.length > 0) {
        const requestedModel =
          body && typeof body === 'object' && body !== null && 'model' in body
            ? (body as { model?: string }).model
            : undefined;

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

    // Select providers based on API key strategy (multi-provider support)
    const requestedModel = body && typeof body === 'object' && 'model' in body ? (body.model as string) : undefined;
    const selectedProviders = await selectProvidersForRequest(apiKey, requestedModel, [
      'official',
      'bedrock',
      'custom',
    ]);
    const debugModeEnabled = await isDebugModeEnabled(apiKey.id);
    const debugRequestHeaders = getDebugHeaders(request.headers);

    if (!selectedProviders || selectedProviders.length === 0) {
      return NextResponse.json(
        {
          error: {
            type: 'configuration_error',
            message: 'No available providers for this API key. Please contact support.',
          },
        },
        { status: 503 }
      );
    }

    // Cache policy: allow cache reads if any selected provider enables caching.
    const cachePolicyProvider = selectedProviders.find((p) => p.cacheEnabled);

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

    const bodyRecord =
      body && typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;

    // Check cache for non-streaming requests
    if (bodyRecord && cachePolicyProvider && isCacheable(bodyRecord)) {
      const model = typeof bodyRecord.model === 'string' ? bodyRecord.model : 'claude-3-5-sonnet-20241022';
      const cacheKey = await generateCacheKey(model, bodyRecord);
      const cachedEntry = await getCachedResponseEntry(cacheKey);

      if (cachedEntry) {
        console.log('Cache hit for request');

        // Return cached response with cache headers
        const headers = new Headers();
        headers.set('X-Cache', 'HIT');
        headers.set('Content-Type', 'application/json');
        addRateLimitHeaders(headers, rateLimitResult);

        await logProxyRequestAsync({
          apiKeyId: apiKey.id,
          providerId: cachePolicyProvider.id,
          providerFamily: 'claude',
          method: request.method,
          path,
          model: cachedEntry.model,
          tokensInput: cachedEntry.tokensInput,
          tokensOutput: cachedEntry.tokensOutput,
          latencyMs: Date.now() - startTime,
          statusCode: 200,
          requestBody: body,
          responseBody: cachedEntry.response,
          cacheHit: true,
          ...requestMetadata,
        });

        if (debugModeEnabled) {
          await logDebugInfo({
            requestId: `debug-${apiKey.id}-${Date.now()}`,
            timestamp: new Date(),
            apiKey: {
              id: apiKey.id,
              prefix: apiKey.keyPrefix,
              rateLimits: {
                requestsPerMinute: apiKey.requestsPerMinute,
                requestsPerDay: apiKey.requestsPerDay,
                tokensPerDay: apiKey.tokensPerDay,
              },
            },
            provider: {
              id: cachePolicyProvider.id,
              name: cachePolicyProvider.name,
              endpoint: cachePolicyProvider.endpoint,
              region: cachePolicyProvider.region || undefined,
            },
            request: {
              method: request.method,
              headers: debugRequestHeaders,
              body,
            },
            response: {
              statusCode: 200,
              headers: Object.fromEntries(headers.entries()),
              body: cachedEntry.response,
              latencyMs: Date.now() - startTime,
            },
            routing: {
              strategy: apiKey.providerSelectionStrategy,
              selectedProvider: cachePolicyProvider.name,
              alternatives: selectedProviders.map((provider) => provider.name),
            },
            caching: {
              cacheHit: true,
              cacheKey,
            },
          });
        }

        return NextResponse.json(cachedEntry.response, {
          status: 200,
          headers,
        });
      }
    }

    // Forward request to Claude API with failover support
    const { response: upstreamResponse, provider: usedProvider } = await makeProxyRequestWithStrategy(
      apiKey,
      selectedProviders,
      path,
      request.method,
      request.headers,
      body
    );

    // Calculate latency
    const latencyMs = Date.now() - startTime;

    // Handle streaming response
    if (isStreamingResponse(upstreamResponse)) {
      // Create streaming proxy with usage tracking
      const streamResponse = await createStreamingResponse(
        upstreamResponse,
        async (usageData) => {
          const model = usageData.model || requestedModel || 'claude';
          // Increment token usage for quota tracking (await to ensure it completes)
          await incrementTokenUsage(apiKey.id, usageData.tokensInput, usageData.tokensOutput);

          await logProxyRequestAsync({
            apiKeyId: apiKey.id,
            providerId: usedProvider.id,
            providerFamily: 'claude',
            method: request.method,
            path,
            model,
            tokensInput: usageData.tokensInput,
            tokensOutput: usageData.tokensOutput,
            latencyMs,
            statusCode: upstreamResponse.status,
            requestBody: body,
            responseText: usageData.responseText,
            streaming: true,
            ...requestMetadata,
          });

          if (debugModeEnabled) {
            await logDebugInfo({
              requestId: `debug-${apiKey.id}-${Date.now()}`,
              timestamp: new Date(),
              apiKey: {
                id: apiKey.id,
                prefix: apiKey.keyPrefix,
                rateLimits: {
                  requestsPerMinute: apiKey.requestsPerMinute,
                  requestsPerDay: apiKey.requestsPerDay,
                  tokensPerDay: apiKey.tokensPerDay,
                },
              },
              provider: {
                id: usedProvider.id,
                name: usedProvider.name,
                endpoint: usedProvider.endpoint,
                region: usedProvider.region || undefined,
              },
              request: {
                method: request.method,
                headers: debugRequestHeaders,
                body,
              },
              response: {
                statusCode: upstreamResponse.status,
                headers: Object.fromEntries(cleanResponseHeaders(streamResponse.headers).entries()),
                body: {
                  model,
                  responseText: usageData.responseText,
                  tokensInput: usageData.tokensInput,
                  tokensOutput: usageData.tokensOutput,
                },
                latencyMs,
              },
              routing: {
                strategy: apiKey.providerSelectionStrategy,
                selectedProvider: usedProvider.name,
                alternatives: selectedProviders.map((provider) => provider.name),
              },
              caching: {
                cacheHit: false,
              },
            });
          }
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
      const model = usageData.model || requestedModel || 'claude';
      // Increment token usage for quota tracking (await to ensure it completes)
      await incrementTokenUsage(apiKey.id, usageData.tokensInput, usageData.tokensOutput);

      await logProxyRequestAsync({
        apiKeyId: apiKey.id,
        providerId: usedProvider.id,
        providerFamily: 'claude',
        method: request.method,
        path,
        model,
        tokensInput: usageData.tokensInput,
        tokensOutput: usageData.tokensOutput,
        latencyMs,
        statusCode: upstreamResponse.status,
        requestBody: body,
        responseBody,
        ...requestMetadata,
      });

      // Cache successful responses if caching is enabled
      if (bodyRecord && usedProvider.cacheEnabled && isCacheable(bodyRecord) && upstreamResponse.status === 200) {
        const cacheKey = await generateCacheKey(model, bodyRecord);
        const ttl = usedProvider.cacheTtlSeconds || 300;

        // Store in cache (don't await - fire and forget)
        setCachedResponse(
          cacheKey,
          responseBody,
          model,
          usageData.tokensInput,
          usageData.tokensOutput,
          ttl
        ).catch((err) => console.error('Cache storage error:', err));
      }
    } else {
      await logProxyRequestAsync({
        apiKeyId: apiKey.id,
        providerId: usedProvider.id,
        providerFamily: 'claude',
        method: request.method,
        path,
        model: requestedModel || 'claude',
        tokensInput: 0,
        tokensOutput: 0,
        latencyMs,
        statusCode: upstreamResponse.status,
        requestBody: body,
        responseBody,
        ...requestMetadata,
      });
    }

    if (debugModeEnabled) {
      await logDebugInfo({
        requestId: `debug-${apiKey.id}-${Date.now()}`,
        timestamp: new Date(),
        apiKey: {
          id: apiKey.id,
          prefix: apiKey.keyPrefix,
          rateLimits: {
            requestsPerMinute: apiKey.requestsPerMinute,
            requestsPerDay: apiKey.requestsPerDay,
            tokensPerDay: apiKey.tokensPerDay,
          },
        },
        provider: {
          id: usedProvider.id,
          name: usedProvider.name,
          endpoint: usedProvider.endpoint,
          region: usedProvider.region || undefined,
        },
        request: {
          method: request.method,
          headers: debugRequestHeaders,
          body,
        },
        response: {
          statusCode: upstreamResponse.status,
          headers: Object.fromEntries(cleanResponseHeaders(upstreamResponse.headers).entries()),
          body: responseBody,
          latencyMs,
        },
        routing: {
          strategy: apiKey.providerSelectionStrategy,
          selectedProvider: usedProvider.name,
          alternatives: selectedProviders.map((provider) => provider.name),
        },
        caching: {
          cacheHit: false,
        },
      });
    }

    // Clean headers and add rate limit info
    const headers = cleanResponseHeaders(upstreamResponse.headers);
    headers.set('X-Cache', 'MISS');
    addRateLimitHeaders(headers, rateLimitResult);

    // Apply response transformations if configured
    let finalBody = responseBody;
    let finalHeaders = headers;
    let finalStatus = upstreamResponse.status;

    const transformationRules = coerceTransformationRules(apiKey.transformationRules);
    if (transformationRules.length > 0) {
      try {
        const transformableResponse = {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText || '',
          headers: Object.fromEntries([...headers.entries()].map(([k, v]) => [k.toLowerCase(), v])),
          body: responseBody,
        };

        const transformed = await transformResponse(
          transformableResponse,
          transformationRules as TransformationRule[],
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
