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

// Configure edge runtime for global distribution
export const runtime = 'edge';

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

    // Fetch provider for this API key
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, apiKey.providerId))
      .limit(1);

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

    // Parse request body if present
    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        body = await request.json();
      } catch {
        // Body might be empty or not JSON
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
        (usageData) => {
          // Increment token usage for quota tracking
          incrementTokenUsage(apiKey.id, usageData.tokensInput, usageData.tokensOutput);

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
      // Increment token usage for quota tracking
      incrementTokenUsage(apiKey.id, usageData.tokensInput, usageData.tokensOutput);

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

    // Clean headers and add rate limit info
    const headers = cleanResponseHeaders(upstreamResponse.headers);
    addRateLimitHeaders(headers, rateLimitResult);

    return NextResponse.json(responseBody, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
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
