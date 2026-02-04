import { NextRequest, NextResponse } from 'next/server';
import { validateApiKeyFromHeaders } from '@/lib/auth/api-key';
import { isValidGeminiPath, extractGeminiModelFromPath } from '@/lib/proxy/gemini';
import { cleanResponseHeaders } from '@/lib/proxy/claude-official';
import { createGeminiStreamingResponse, isGeminiStreamingResponse, parseGeminiNonStreamingResponse } from '@/lib/proxy/gemini-streaming';
import { checkRateLimit, addRateLimitHeaders, createRateLimitResponse } from '@/lib/rate-limit';
import { checkQuota, createQuotaExceededResponse, incrementTokenUsage } from '@/lib/rate-limit/quota-checker';
import { logUsageAsync, extractRequestMetadata } from '@/lib/analytics/logger';
import { UnauthorizedError } from '@/types';
import { validateIpAccess, getClientIp } from '@/lib/security/ip-security';
import { verifyHmacSignature, extractHmacHeaders } from '@/lib/security/hmac';
import { isKeyExpired } from '@/lib/key-rotation';
import { getCachedResponse, setCachedResponse, generateCacheKey, isCacheable } from '@/lib/cache';
import { transformResponse, type TransformationRule, coerceTransformationRules } from '@/lib/proxy/response-transformer';
import { z } from 'zod';
import { selectProvidersForRequest } from '@/lib/proxy/provider-selector';
import { makeProxyRequestWithStrategy } from '@/lib/proxy/failover';
import { verifyTOTP } from '@/lib/security/2fa';
import { readJsonBodyIfPresent } from '@/lib/http/request-body';

export const runtime = 'edge';

const scopesSchema = z.object({
  models: z.array(z.string()).optional(),
  endpoints: z.array(z.string()).optional(),
}).nullable();

/**
 * Catch-all proxy route: /api/gemini/[...path]
 * Forwards Google Gemini API requests
 */
async function handleRequest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const startTime = Date.now();

  try {
    const { path: pathSegments } = await context.params;
    const path = `/${pathSegments.join('/')}`;
    const requestUrl = new URL(request.url);
    const pathWithQuery = `${path}${requestUrl.search}`;

    const requestMetadata = extractRequestMetadata(request.headers);

    if (!isValidGeminiPath(path)) {
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

    const requestedModel = extractGeminiModelFromPath(path)
      || (body && typeof body === 'object' && 'model' in body ? (body.model as string) : undefined);

    if (apiKey.scopes) {
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

      if (scopes && scopes.models && scopes.models.length > 0) {
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

    const selectedProviders = await selectProvidersForRequest(apiKey, requestedModel, ['gemini']);

    if (!selectedProviders || selectedProviders.length === 0) {
      return NextResponse.json(
        {
          error: {
            type: 'configuration_error',
            message: 'No available Gemini providers for this API key. Please contact support.',
          },
        },
        { status: 503 }
      );
    }

    const cachePolicyProvider = selectedProviders.find((p) => p.cacheEnabled);

    const rateLimitResult = await checkRateLimit(apiKey);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    const quotaResult = await checkQuota(apiKey);
    if (!quotaResult.allowed) {
      return createQuotaExceededResponse(quotaResult);
    }

    const bodyRecord =
      body && typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;

    if (bodyRecord && cachePolicyProvider && isCacheable(bodyRecord)) {
      const cacheKey = await generateCacheKey(requestedModel || 'gemini', bodyRecord);
      const cachedResponse = await getCachedResponse(cacheKey);

      if (cachedResponse) {
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

    const { response: upstreamResponse, provider: usedProvider } = await makeProxyRequestWithStrategy(
      apiKey,
      selectedProviders,
      pathWithQuery,
      request.method,
      request.headers,
      body
    );

    const latencyMs = Date.now() - startTime;

    if (isGeminiStreamingResponse(upstreamResponse)) {
      const streamingResponse = await createGeminiStreamingResponse(
        upstreamResponse,
        async (usageData) => {
          const model = usageData.model || requestedModel || 'gemini';
          await incrementTokenUsage(apiKey.id, usageData.tokensInput, usageData.tokensOutput);
          await logUsageAsync({
            apiKeyId: apiKey.id,
            method: request.method,
            path,
            model,
            tokensInput: usageData.tokensInput,
            tokensOutput: usageData.tokensOutput,
            latencyMs,
            statusCode: upstreamResponse.status,
            userAgent: requestMetadata.userAgent,
            ipAddress: requestMetadata.ipAddress,
            country: requestMetadata.country,
          });
        }
      );

      const headers = cleanResponseHeaders(streamingResponse.headers);
      headers.set('X-Cache', 'MISS');
      addRateLimitHeaders(headers, rateLimitResult);

      return new Response(streamingResponse.body, {
        status: streamingResponse.status,
        statusText: streamingResponse.statusText,
        headers,
      });
    }

    const { body: responseBody, usageData } = await parseGeminiNonStreamingResponse(upstreamResponse);

    if (usageData) {
      const model = usageData.model || requestedModel || 'gemini';
      await incrementTokenUsage(apiKey.id, usageData.tokensInput, usageData.tokensOutput);
      await logUsageAsync({
        apiKeyId: apiKey.id,
        method: request.method,
        path,
        model,
        tokensInput: usageData.tokensInput,
        tokensOutput: usageData.tokensOutput,
        latencyMs,
        statusCode: upstreamResponse.status,
        userAgent: requestMetadata.userAgent,
        ipAddress: requestMetadata.ipAddress,
        country: requestMetadata.country,
      });
    } else {
      await logUsageAsync({
        apiKeyId: apiKey.id,
        method: request.method,
        path,
        model: requestedModel || 'gemini',
        tokensInput: 0,
        tokensOutput: 0,
        latencyMs,
        statusCode: upstreamResponse.status,
        userAgent: requestMetadata.userAgent,
        ipAddress: requestMetadata.ipAddress,
        country: requestMetadata.country,
      });
    }

    if (bodyRecord && usedProvider.cacheEnabled && isCacheable(bodyRecord) && upstreamResponse.ok) {
      const cacheKey = await generateCacheKey(requestedModel || 'gemini', bodyRecord);
      const cacheModel = usageData?.model || requestedModel || 'gemini';
      const ttl = usedProvider.cacheTtlSeconds || 300;
      setCachedResponse(
        cacheKey,
        responseBody,
        cacheModel,
        usageData?.tokensInput ?? 0,
        usageData?.tokensOutput ?? 0,
        ttl
      ).catch((err) => console.error('Cache storage error:', err));
    }

    const headers = cleanResponseHeaders(upstreamResponse.headers);
    headers.set('X-Cache', 'MISS');
    addRateLimitHeaders(headers, rateLimitResult);

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
            model: usageData?.model || requestedModel || undefined,
            endpoint: path,
          }
        );

        finalBody = transformed.body;
        finalStatus = transformed.status;

        finalHeaders = new Headers();
        for (const [key, value] of Object.entries(transformed.headers)) {
          finalHeaders.set(key, value);
        }
      } catch (transformError) {
        console.error('Response transformation error:', transformError);
      }
    }

    return NextResponse.json(finalBody, {
      status: finalStatus,
      statusText: upstreamResponse.statusText,
      headers: finalHeaders,
    });
  } catch (error) {
    console.error('Gemini proxy error:', error);

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

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;
