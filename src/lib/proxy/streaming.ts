/**
 * SSE (Server-Sent Events) streaming handler for Claude API responses
 * Parses streaming chunks to extract usage data while proxying to client
 */

export interface StreamUsageData {
  tokensInput: number;
  tokensOutput: number;
  model: string;
}

/**
 * Create a streaming response that proxies chunks and extracts usage data
 * Usage data is collected as the stream progresses
 */
export async function createStreamingResponse(
  upstreamResponse: Response,
  onComplete?: (usageData: StreamUsageData) => void
): Promise<Response> {
  const reader = upstreamResponse.body?.getReader();
  if (!reader) {
    throw new Error('Upstream response has no body');
  }

  const usageData: Partial<StreamUsageData> = {
    tokensInput: 0,
    tokensOutput: 0,
    model: '',
  };

  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Stream completed - call onComplete with usage data
            if (onComplete && usageData.model) {
              onComplete(usageData as StreamUsageData);
            }
            controller.close();
            break;
          }

          // Decode chunk
          const chunk = decoder.decode(value, { stream: true });

          // Parse SSE events to extract usage data
          parseSSEChunk(chunk, usageData);

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

        // Extract model name from message_start event
        if (data.type === 'message_start' && data.message?.model) {
          usageData.model = data.message.model;
        }

        // Extract usage from message_start event
        if (data.type === 'message_start' && data.message?.usage) {
          usageData.tokensInput = data.message.usage.input_tokens || 0;
          usageData.tokensOutput = data.message.usage.output_tokens || 0;
        }

        // Update token counts from message_delta events
        if (data.type === 'message_delta' && data.usage) {
          usageData.tokensOutput = data.usage.output_tokens || usageData.tokensOutput;
        }

        // Final usage from message_stop or content_block_stop
        if (data.type === 'message_delta' && data.delta?.usage) {
          usageData.tokensInput = data.delta.usage.input_tokens || usageData.tokensInput;
          usageData.tokensOutput = data.delta.usage.output_tokens || usageData.tokensOutput;
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
