/**
 * SSE (Server-Sent Events) streaming handler for Claude API responses
 * Parses streaming chunks to extract usage data while proxying to client
 */

export interface StreamUsageData {
  tokensInput: number;
  tokensOutput: number;
  model: string;
  responseText?: string;
}

/**
 * Create a streaming response that proxies chunks and extracts usage data
 * Usage data is collected as the stream progresses
 */
export async function createStreamingResponse(
  upstreamResponse: Response,
  onComplete?: (usageData: StreamUsageData) => void | Promise<void>
): Promise<Response> {
  const reader = upstreamResponse.body?.getReader();
  if (!reader) {
    throw new Error('Upstream response has no body');
  }

  const usageData: Partial<StreamUsageData> = {
    tokensInput: 0,
    tokensOutput: 0,
    model: '',
    responseText: '',
  };

  const decoder = new TextDecoder();
  let buffer = ''; // Buffer for incomplete SSE events

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Process any remaining buffered data
            if (buffer.length > 0) {
              parseSSEChunk(buffer, usageData);
            }

            // Stream completed - call onComplete with usage data
            if (onComplete && usageData.model) {
              await onComplete(usageData as StreamUsageData);
            }
            controller.close();
            break;
          }

          // Decode chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete events from buffer
          const lines = buffer.split('\n');
          // Keep the last potentially incomplete line in buffer
          buffer = lines.pop() || '';

          // Parse complete lines
          const completeChunk = lines.join('\n');
          if (completeChunk.length > 0) {
            parseSSEChunk(completeChunk, usageData);
          }

          // Forward chunk to client
          controller.enqueue(value);
        }
      } catch (error) {
        console.error('Streaming error:', error);
        controller.error(error);
      }
    },
  });

  // Return streaming response with original headers
  return new Response(stream, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}

/**
 * Parse SSE chunk to extract usage information
 * Claude API sends usage data in specific events
 */
function parseSSEChunk(chunk: string, usageData: Partial<StreamUsageData>) {
  // Split by newlines to process each event
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));

        const updateUsage = (usage?: { input_tokens?: number; output_tokens?: number }) => {
          if (!usage) return;
          if (typeof usage.input_tokens === 'number') {
            usageData.tokensInput = Math.max(usageData.tokensInput || 0, usage.input_tokens);
          }
          if (typeof usage.output_tokens === 'number') {
            usageData.tokensOutput = Math.max(usageData.tokensOutput || 0, usage.output_tokens);
          }
        };

        // Extract model name from message_start event
        if (data.type === 'message_start' && data.message?.model) {
          usageData.model = data.message.model;
        }

        // Usage can appear in message_start, message_delta, or final stop events
        if (data.message?.usage) {
          updateUsage(data.message.usage);
        }
        if (data.usage) {
          updateUsage(data.usage);
        }
        if (data.delta?.usage) {
          updateUsage(data.delta.usage);
        }

        if (data.type === 'content_block_delta' && typeof data.delta?.text === 'string') {
          usageData.responseText = `${usageData.responseText || ''}${data.delta.text}`;
        }
      } catch {
        // Ignore JSON parse errors (non-JSON events)
      }
    }
  }
}

/**
 * Check if a response is a streaming response
 */
export function isStreamingResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return contentType?.includes('text/event-stream') || false;
}

/**
 * Parse non-streaming response to extract usage data
 */
export async function parseNonStreamingResponse(response: Response): Promise<{
  body: unknown;
  usageData: StreamUsageData | null;
}> {
  try {
    const body = await response.json();

    // Claude API returns usage in response body
    if (body.usage && body.model) {
      return {
        body,
        usageData: {
          tokensInput: body.usage.input_tokens || 0,
          tokensOutput: body.usage.output_tokens || 0,
          model: body.model,
        },
      };
    }

    return { body, usageData: null };
  } catch (error) {
    console.error('Error parsing non-streaming response:', error);
    return { body: null, usageData: null };
  }
}
