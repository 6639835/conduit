/**
 * Response Transformation Library
 *
 * Provides flexible response transformation capabilities for API responses.
 * Supports header manipulation, body transformation, and custom transformations.
 */

export interface TransformationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number; // Lower number = higher priority
  type: 'header' | 'body' | 'custom';
  condition?: TransformCondition;
  action: TransformAction;
}

export interface TransformCondition {
  // Match conditions (all must be true)
  modelPattern?: string; // Regex pattern for model names
  endpointPattern?: string; // Regex pattern for endpoints
  statusCode?: number | number[]; // Match specific status codes
  hasHeader?: string; // Check if header exists
}

export interface TransformAction {
  // Header transformations
  addHeaders?: Record<string, string>;
  removeHeaders?: string[];
  modifyHeaders?: Record<string, (value: string) => string>;
  renameHeaders?: Record<string, string>;

  // Body transformations
  bodyTransform?: (body: unknown) => unknown;
  body?: StoredBodyAction;

  // Custom transformation function
  customTransform?: (response: TransformableResponse) => TransformableResponse;
}

export type StoredBodyAction =
  | { mode: 'merge'; value: Record<string, unknown> }
  | { mode: 'redact'; fields: string[] }
  | { mode: 'replaceErrorMessage'; message: string };

export interface TransformableResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

export function coerceTransformationRules(input: unknown): TransformationRule[] {
  if (!Array.isArray(input)) return [];

  const rules: TransformationRule[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const maybe = raw as Partial<TransformationRule> & { action?: unknown };
    if (typeof maybe.id !== 'string' || typeof maybe.name !== 'string') continue;

    const type = maybe.type;
    if (type !== 'header' && type !== 'body' && type !== 'custom') continue;

    const actionRaw = (maybe as { action?: unknown }).action;
    if (!actionRaw || typeof actionRaw !== 'object') continue;

    const actionIn = actionRaw as Record<string, unknown>;
    const action: TransformAction = {};

    if (actionIn.addHeaders && typeof actionIn.addHeaders === 'object' && !Array.isArray(actionIn.addHeaders)) {
      action.addHeaders = actionIn.addHeaders as Record<string, string>;
    }
    if (Array.isArray(actionIn.removeHeaders) && actionIn.removeHeaders.every((h) => typeof h === 'string')) {
      action.removeHeaders = actionIn.removeHeaders as string[];
    }
    if (actionIn.renameHeaders && typeof actionIn.renameHeaders === 'object' && !Array.isArray(actionIn.renameHeaders)) {
      action.renameHeaders = actionIn.renameHeaders as Record<string, string>;
    }

    // Allow function-based transforms when rules are provided programmatically.
    if (typeof actionIn.bodyTransform === 'function') action.bodyTransform = actionIn.bodyTransform as TransformAction['bodyTransform'];
    if (typeof actionIn.customTransform === 'function') action.customTransform = actionIn.customTransform as TransformAction['customTransform'];
    if (actionIn.modifyHeaders && typeof actionIn.modifyHeaders === 'object' && !Array.isArray(actionIn.modifyHeaders)) {
      const mh = actionIn.modifyHeaders as Record<string, unknown>;
      if (Object.values(mh).every((v) => typeof v === 'function')) {
        action.modifyHeaders = mh as Record<string, (value: string) => string>;
      }
    }

    // JSON-safe body transforms
    if (actionIn.body && typeof actionIn.body === 'object' && !Array.isArray(actionIn.body)) {
      const b = actionIn.body as Record<string, unknown>;
      const mode = b.mode;
      if (mode === 'merge' && b.value && typeof b.value === 'object' && !Array.isArray(b.value)) {
        action.body = { mode, value: b.value as Record<string, unknown> };
      } else if (mode === 'redact' && Array.isArray(b.fields) && b.fields.every((f) => typeof f === 'string')) {
        action.body = { mode, fields: b.fields as string[] };
      } else if (mode === 'replaceErrorMessage' && typeof b.message === 'string') {
        action.body = { mode, message: b.message };
      }
    }

    rules.push({
      id: maybe.id,
      name: maybe.name,
      enabled: typeof maybe.enabled === 'boolean' ? maybe.enabled : true,
      priority: typeof maybe.priority === 'number' ? maybe.priority : 100,
      type,
      condition: maybe.condition,
      action,
    });
  }

  return rules;
}

/**
 * Apply transformation rules to a response
 */
export async function transformResponse(
  response: TransformableResponse,
  rules: TransformationRule[],
  context: {
    model?: string;
    endpoint: string;
  }
): Promise<TransformableResponse> {
  // Sort rules by priority
  const sortedRules = rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority);

  let transformedResponse = { ...response };

  for (const rule of sortedRules) {
    // Check if rule condition matches
    if (rule.condition && !matchesCondition(rule.condition, transformedResponse, context)) {
      continue;
    }

    // Apply transformation based on type
    transformedResponse = await applyTransformation(rule, transformedResponse);
  }

  return transformedResponse;
}

/**
 * Check if a condition matches the current request/response
 */
function matchesCondition(
  condition: TransformCondition,
  response: TransformableResponse,
  context: { model?: string; endpoint: string }
): boolean {
  // Check model pattern
  if (condition.modelPattern && context.model) {
    const regex = new RegExp(condition.modelPattern);
    if (!regex.test(context.model)) {
      return false;
    }
  }

  // Check endpoint pattern
  if (condition.endpointPattern) {
    const regex = new RegExp(condition.endpointPattern);
    if (!regex.test(context.endpoint)) {
      return false;
    }
  }

  // Check status code
  if (condition.statusCode) {
    const codes = Array.isArray(condition.statusCode)
      ? condition.statusCode
      : [condition.statusCode];
    if (!codes.includes(response.status)) {
      return false;
    }
  }

  // Check header exists
  if (condition.hasHeader) {
    if (!response.headers[condition.hasHeader]) {
      return false;
    }
  }

  return true;
}

/**
 * Apply a transformation rule to a response
 */
async function applyTransformation(
  rule: TransformationRule,
  response: TransformableResponse
): Promise<TransformableResponse> {
  let transformed = { ...response };

  const { action } = rule;

  // Apply header transformations
  if (action.addHeaders) {
    transformed.headers = {
      ...transformed.headers,
      ...action.addHeaders,
    };
  }

  if (action.removeHeaders) {
    transformed.headers = { ...transformed.headers };
    for (const header of action.removeHeaders) {
      delete transformed.headers[header];
    }
  }

  if (action.renameHeaders) {
    transformed.headers = { ...transformed.headers };
    for (const [from, to] of Object.entries(action.renameHeaders)) {
      if (from === to) continue;
      if (transformed.headers[from] !== undefined) {
        transformed.headers[to] = transformed.headers[from];
        delete transformed.headers[from];
      }
    }
  }

  if (action.modifyHeaders) {
    transformed.headers = { ...transformed.headers };
    for (const [header, modifier] of Object.entries(action.modifyHeaders)) {
      if (transformed.headers[header]) {
        transformed.headers[header] = modifier(transformed.headers[header]);
      }
    }
  }

  // Apply body transformation
  if (action.bodyTransform) {
    transformed.body = action.bodyTransform(transformed.body);
  }

  if (action.body) {
    if (action.body.mode === 'merge') {
      if (typeof transformed.body === 'object' && transformed.body !== null && !Array.isArray(transformed.body)) {
        transformed.body = { ...(transformed.body as Record<string, unknown>), ...action.body.value };
      }
    } else if (action.body.mode === 'redact') {
      if (typeof transformed.body === 'object' && transformed.body !== null && !Array.isArray(transformed.body)) {
        const copy = { ...(transformed.body as Record<string, unknown>) };
        for (const field of action.body.fields) {
          delete copy[field];
        }
        transformed.body = copy;
      }
    } else if (action.body.mode === 'replaceErrorMessage') {
      if (typeof transformed.body === 'object' && transformed.body !== null && !Array.isArray(transformed.body)) {
        const copy = { ...(transformed.body as Record<string, unknown>) };
        const err = copy.error;
        if (err && typeof err === 'object' && !Array.isArray(err)) {
          (err as Record<string, unknown>).message = action.body.message;
          copy.error = err;
          transformed.body = copy;
        }
      }
    }
  }

  // Apply custom transformation
  if (action.customTransform) {
    transformed = action.customTransform(transformed);
  }

  return transformed;
}

/**
 * Common transformation rules
 */
export const commonTransformations = {
  /**
   * Add CORS headers to all responses
   */
  addCorsHeaders: (): TransformationRule => ({
    id: 'add-cors-headers',
    name: 'Add CORS Headers',
    enabled: true,
    priority: 1,
    type: 'header',
    action: {
      addHeaders: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      },
    },
  }),

  /**
   * Add custom branding headers
   */
  addBrandingHeaders: (brandName: string): TransformationRule => ({
    id: 'add-branding-headers',
    name: 'Add Branding Headers',
    enabled: true,
    priority: 2,
    type: 'header',
    action: {
      addHeaders: {
        'X-Powered-By': brandName,
        'X-API-Version': 'v2.0',
      },
    },
  }),

  /**
   * Remove sensitive headers
   */
  removeSensitiveHeaders: (): TransformationRule => ({
    id: 'remove-sensitive-headers',
    name: 'Remove Sensitive Headers',
    enabled: true,
    priority: 1,
    type: 'header',
    action: {
      removeHeaders: [
        'x-api-key',
        'authorization',
        'set-cookie',
        'x-internal-token',
      ],
    },
  }),

  /**
   * Add usage metadata to response body
   */
  addUsageMetadata: (keyId: string, keyName?: string): TransformationRule => ({
    id: 'add-usage-metadata',
    name: 'Add Usage Metadata',
    enabled: true,
    priority: 5,
    type: 'body',
    condition: {
      statusCode: [200, 201],
    },
    action: {
      bodyTransform: (body) => {
        if (typeof body === 'object' && body !== null) {
          return {
            ...body,
            _metadata: {
              apiKeyId: keyId,
              apiKeyName: keyName || 'unnamed',
              timestamp: new Date().toISOString(),
              gateway: 'conduit',
            },
          };
        }
        return body;
      },
    },
  }),

  /**
   * Filter sensitive fields from error responses
   */
  filterErrorDetails: (): TransformationRule => ({
    id: 'filter-error-details',
    name: 'Filter Error Details',
    enabled: true,
    priority: 3,
    type: 'body',
    condition: {
      statusCode: [500, 502, 503, 504],
    },
    action: {
      bodyTransform: (body) => {
        if (typeof body === 'object' && body !== null) {
          // Remove stack traces and internal error details
          const filtered = { ...body } as Record<string, unknown>;
          delete filtered.stack;
          delete filtered.trace;
          delete filtered.internalError;

          // Replace with generic message if needed
          const error = filtered.error as Record<string, unknown> | undefined;
          if (error?.message) {
            error.message = 'An internal error occurred. Please try again.';
          }

          return filtered;
        }
        return body;
      },
    },
  }),

  /**
   * Transform Claude API response to OpenAI format
   */
  transformToOpenAIFormat: (): TransformationRule => ({
    id: 'transform-to-openai',
    name: 'Transform to OpenAI Format',
    enabled: false, // Disabled by default
    priority: 10,
    type: 'body',
    condition: {
      statusCode: 200,
      endpointPattern: '/v1/messages',
    },
    action: {
      bodyTransform: (body) => {
        const claudeBody = body as Record<string, unknown>;
        if (claudeBody && claudeBody.content && Array.isArray(claudeBody.content)) {
          // Transform Claude format to OpenAI-like format
          return {
            id: claudeBody.id || `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: claudeBody.model || 'claude',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: (claudeBody.content as Array<{ type: string; text?: string }>)
                    .filter((c) => c.type === 'text')
                    .map((c) => c.text)
                    .join(''),
                },
                finish_reason: claudeBody.stop_reason || 'stop',
              },
            ],
            usage: claudeBody.usage || {},
          };
        }
        return body;
      },
    },
  }),

  /**
   * Add rate limit information to headers
   */
  addRateLimitHeaders: (
    remaining: number,
    limit: number,
    reset: Date
  ): TransformationRule => ({
    id: 'add-rate-limit-headers',
    name: 'Add Rate Limit Headers',
    enabled: true,
    priority: 2,
    type: 'header',
    action: {
      addHeaders: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': reset.toISOString(),
      },
    },
  }),
};

/**
 * Load transformation rules from database
 */
export async function loadTransformationRules(_apiKeyId: string): Promise<TransformationRule[]> {
  // In a real implementation, this would load from database
  // For now, return common transformations
  return [
    commonTransformations.addBrandingHeaders('Conduit API Gateway'),
    commonTransformations.removeSensitiveHeaders(),
    commonTransformations.filterErrorDetails(),
  ];
}

/**
 * Create a response transformer for an API key
 */
export function createResponseTransformer(apiKeyId: string, _keyName?: string) {
  return async (
    response: TransformableResponse,
    context: { model?: string; endpoint: string }
  ): Promise<TransformableResponse> => {
    const rules = await loadTransformationRules(apiKeyId);
    return transformResponse(response, rules, context);
  };
}
