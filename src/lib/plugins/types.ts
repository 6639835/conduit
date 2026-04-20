/**
 * Plugin System Types
 * Type definitions for the Conduit plugin system
 */

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  category: PluginCategory;
  tags: string[];
  icon?: string;
  isOfficial: boolean;
  isInstalled: boolean;
  isEnabled: boolean;
  config?: Record<string, unknown>;
  hooks: PluginHooks;
  dependencies?: string[];
  repository?: string;
  license?: string;
  downloads?: number;
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum PluginCategory {
  AUTHENTICATION = 'authentication',
  MONITORING = 'monitoring',
  ANALYTICS = 'analytics',
  CACHING = 'caching',
  RATE_LIMITING = 'rate-limiting',
  TRANSFORMATION = 'transformation',
  LOGGING = 'logging',
  NOTIFICATION = 'notification',
  SECURITY = 'security',
  INTEGRATION = 'integration',
  OTHER = 'other',
}

export interface PluginHooks {
  // Request lifecycle hooks
  onRequestReceived?: (context: RequestContext) => Promise<RequestContext>;
  onBeforeProviderCall?: (context: RequestContext) => Promise<RequestContext>;
  onAfterProviderCall?: (context: ResponseContext) => Promise<ResponseContext>;
  onBeforeResponse?: (context: ResponseContext) => Promise<ResponseContext>;
  onError?: (context: ErrorContext) => Promise<ErrorContext>;

  // System hooks
  onPluginInstall?: () => Promise<void>;
  onPluginUninstall?: () => Promise<void>;
  onPluginEnable?: () => Promise<void>;
  onPluginDisable?: () => Promise<void>;
  onConfigUpdate?: (newConfig: Record<string, unknown>) => Promise<void>;

  // Analytics hooks
  onRequestComplete?: (metrics: RequestMetrics) => Promise<void>;
  onDailyReport?: (report: DailyReport) => Promise<void>;

  // Admin hooks
  onApiKeyCreated?: (apiKey: ApiKeyInfo) => Promise<void>;
  onApiKeyRevoked?: (apiKey: ApiKeyInfo) => Promise<void>;
}

/**
 * Hook names whose functions take a single context argument and resolve to the
 * same context type (i.e., "pipeline" hooks).
 */
export type ContextHookName = keyof PluginHooks & {
  [K in keyof PluginHooks]: NonNullable<PluginHooks[K]> extends (context: infer C) => Promise<infer R>
    ? (C extends R ? (R extends C ? K : never) : never)
    : never;
}[keyof PluginHooks];

export type ContextHookContext<T extends ContextHookName> =
  NonNullable<PluginHooks[T]> extends (context: infer C) => Promise<unknown> ? C : never;

export interface RequestContext {
  requestId: string;
  apiKeyId: string;
  providerId: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature: number;
  maxTokens: number;
  headers: Record<string, string>;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface ResponseContext extends RequestContext {
  response: {
    id: string;
    content: string;
    model: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  statusCode: number;
  latencyMs: number;
  cost: number;
}

export interface ErrorContext extends RequestContext {
  error: {
    code: string;
    message: string;
    stack?: string;
  };
  statusCode: number;
}

export interface RequestMetrics {
  requestId: string;
  apiKeyId: string;
  providerId: string;
  model: string;
  statusCode: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  timestamp: Date;
}

export interface DailyReport {
  date: Date;
  totalRequests: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
  topModels: Array<{ model: string; count: number }>;
}

export interface ApiKeyInfo {
  id: string;
  name: string | null;
  keyPrefix: string;
  providerId: string;
  organizationId: string | null;
  createdAt: Date;
}

export interface PluginConfig {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
    label: string;
    description?: string;
    default?: unknown;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    validation?: {
      min?: number;
      max?: number;
      pattern?: string;
    };
  };
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  category: PluginCategory;
  tags: string[];
  icon?: string;
  repository?: string;
  license?: string;
  dependencies?: string[];
  config?: PluginConfig;
  hooks: string[]; // List of hook names this plugin implements
}

export interface PluginExecutionResult {
  success: boolean;
  error?: string;
  data?: unknown;
  metrics?: {
    executionTimeMs: number;
  };
}
