/**
 * SSE streaming handler for OpenAI Responses API
 * Parses streaming chunks to extract usage data while proxying to client
 */

export interface OpenAIUsageData {
  tokensInput: number;
  tokensOutput: number;
  model: string;
  responseText?: string;
}

function applyUsage(
  usageData: Partial<OpenAIUsageData>,
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  }
) {
  if (!usage) return;

  const input = typeof usage.input_tokens === 'number'
    ? usage.input_tokens
    : typeof usage.prompt_tokens === 'number'
      ? usage.prompt_tokens
      : undefined;

  const output = typeof usage.output_tokens === 'number'
    ? usage.output_tokens
    : typeof usage.completion_tokens === 'number'
      ? usage.completion_tokens
      : undefined;

  if (typeof input === 'number') {
    usageData.tokensInput = Math.max(usageData.tokensInput || 0, input);
  }
  if (typeof output === 'number') {
    usageData.tokensOutput = Math.max(usageData.tokensOutput || 0, output);
  }
}

/**
 * Create a streaming response that proxies chunks and extracts usage data
 */
export async function createOpenAIStreamingResponse(
  upstreamResponse: Response,
  onComplete?: (usageData: OpenAIUsageData) => void | Promise<void>
): Promise<Response> {
  const reader = upstreamResponse.body?.getReader();
  if (!reader) {
    throw new Error('Upstream response has no body');
  }

  const usageData: Partial<OpenAIUsageData> = {
    tokensInput: 0,
    tokensOutput: 0,
    model: '',
    responseText: '',
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
              parseOpenAISSEChunk(buffer, usageData);
            }

            if (onComplete && usageData.model) {
              await onComplete(usageData as OpenAIUsageData);
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
            parseOpenAISSEChunk(completeChunk, usageData);
          }

          controller.enqueue(value);
        }
      } catch (error) {
        console.error('OpenAI streaming error:', error);
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

function parseOpenAISSEChunk(chunk: string, usageData: Partial<OpenAIUsageData>) {
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;

    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') {
      continue;
    }

    try {
      const data = JSON.parse(payload);

      if (data.model && typeof data.model === 'string') {
        usageData.model = data.model;
      }

      if (data.response?.model && typeof data.response.model === 'string') {
        usageData.model = data.response.model;
      }

      applyUsage(usageData, data.usage);
      applyUsage(usageData, data.response?.usage);

      if (data.type && (data.type === 'response.completed' || data.type === 'response.done')) {
        applyUsage(usageData, data.response?.usage);
      }

      if (data.type === 'response.output_text.delta' && typeof data.delta === 'string') {
        usageData.responseText = `${usageData.responseText || ''}${data.delta}`;
      }

      const deltaText = extractOpenAITextDelta(data);
      if (deltaText) {
        usageData.responseText = `${usageData.responseText || ''}${deltaText}`;
      }
    } catch {
      // Ignore JSON parse errors (non-JSON events)
    }
  }
}

function extractOpenAITextDelta(data: unknown): string {
  if (!data || typeof data !== 'object') return '';

  const record = data as {
    choices?: Array<{ delta?: { content?: unknown } }>;
  };

  if (Array.isArray(record.choices)) {
    const parts: string[] = [];

    for (const choice of record.choices) {
      const content = choice?.delta?.content;
      if (typeof content === 'string') {
        parts.push(content);
      } else if (Array.isArray(content)) {
        for (const item of content) {
          const text = typeof item === 'object' && item && 'text' in item
            ? (item as { text?: unknown }).text
            : undefined;
          if (typeof text === 'string') {
            parts.push(text);
          }
        }
      }
    }

    return parts.join('');
  }

  return '';
}

export function isOpenAIStreamingResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return contentType?.includes('text/event-stream') || false;
}

export async function parseOpenAINonStreamingResponse(response: Response): Promise<{
  body: unknown;
  usageData: OpenAIUsageData | null;
}> {
  try {
    const body = await response.json();

    const usage = (body as { usage?: Record<string, number> }).usage;
    const responseUsage = (body as { response?: { usage?: Record<string, number> } }).response?.usage;

    if ((usage || responseUsage) && typeof body === 'object' && body) {
      const model = (body as { model?: string }).model
        || (body as { response?: { model?: string } }).response?.model
        || '';

      const usageData: OpenAIUsageData = {
        tokensInput: 0,
        tokensOutput: 0,
        model,
      };

      applyUsage(usageData, usage as { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number });
      applyUsage(usageData, responseUsage as { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number });

      if (usageData.model) {
        return { body, usageData };
      }
    }

    return { body, usageData: null };
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    return { body: null, usageData: null };
  }
}
