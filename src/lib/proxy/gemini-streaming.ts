/**
 * SSE streaming handler for Gemini API responses
 * Parses streaming chunks to extract usage data while proxying to client
 */

export interface GeminiUsageData {
  tokensInput: number;
  tokensOutput: number;
  model: string;
}

function applyUsage(
  usageData: Partial<GeminiUsageData>,
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  }
) {
  if (!usage) return;

  const prompt = typeof usage.promptTokenCount === 'number'
    ? usage.promptTokenCount
    : undefined;
  const candidates = typeof usage.candidatesTokenCount === 'number'
    ? usage.candidatesTokenCount
    : undefined;
  const total = typeof usage.totalTokenCount === 'number'
    ? usage.totalTokenCount
    : undefined;

  if (typeof prompt === 'number') {
    usageData.tokensInput = Math.max(usageData.tokensInput || 0, prompt);
  }

  if (typeof candidates === 'number') {
    usageData.tokensOutput = Math.max(usageData.tokensOutput || 0, candidates);
  } else if (typeof total === 'number' && typeof prompt === 'number') {
    usageData.tokensOutput = Math.max(usageData.tokensOutput || 0, total - prompt);
  }
}

/**
 * Create a streaming response that proxies chunks and extracts usage data
 */
export async function createGeminiStreamingResponse(
  upstreamResponse: Response,
  onComplete?: (usageData: GeminiUsageData) => void | Promise<void>
): Promise<Response> {
  const reader = upstreamResponse.body?.getReader();
  if (!reader) {
    throw new Error('Upstream response has no body');
  }

  const usageData: Partial<GeminiUsageData> = {
    tokensInput: 0,
    tokensOutput: 0,
    model: '',
  };

  const decoder = new TextDecoder();
  let buffer = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (buffer.length > 0) {
              parseGeminiSSEChunk(buffer, usageData);
            }

            if (onComplete && (usageData.tokensInput || usageData.tokensOutput)) {
              await onComplete(usageData as GeminiUsageData);
            }
            controller.close();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          const completeChunk = lines.join('\n');
          if (completeChunk.length > 0) {
            parseGeminiSSEChunk(completeChunk, usageData);
          }

          controller.enqueue(value);
        }
      } catch (error) {
        console.error('Gemini streaming error:', error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}

function parseGeminiSSEChunk(chunk: string, usageData: Partial<GeminiUsageData>) {
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;

    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') {
      continue;
    }

    try {
      const data = JSON.parse(payload) as {
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
        modelVersion?: string;
        model?: string;
      };

      if (data.modelVersion && typeof data.modelVersion === 'string') {
        usageData.model = data.modelVersion;
      } else if (data.model && typeof data.model === 'string') {
        usageData.model = data.model;
      }

      applyUsage(usageData, data.usageMetadata);
    } catch {
      // Ignore JSON parse errors (non-JSON events)
    }
  }
}

export function isGeminiStreamingResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return contentType?.includes('text/event-stream') || false;
}

export async function parseGeminiNonStreamingResponse(response: Response): Promise<{
  body: unknown;
  usageData: GeminiUsageData | null;
}> {
  try {
    const body = await response.json();

    const usageMetadata = (body as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }).usageMetadata;
    const model = (body as { modelVersion?: string; model?: string }).modelVersion
      || (body as { model?: string }).model
      || '';

    if (usageMetadata) {
      const usageData: GeminiUsageData = {
        tokensInput: 0,
        tokensOutput: 0,
        model,
      };

      applyUsage(usageData, usageMetadata);
      return { body, usageData };
    }

    return { body, usageData: null };
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    return { body: null, usageData: null };
  }
}
