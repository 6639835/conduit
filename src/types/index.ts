import type { ApiKey, UsageLog, UsageAggregate } from '@/lib/db/schema';

// Re-export database types
export type { ApiKey, UsageLog, UsageAggregate };

// API request/response types

export interface CreateApiKeyRequest {
  name?: string;
  provider: string; // Provider ID (UUID)
  requestsPerMinute?: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
  monthlySpendLimitUsd?: number;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  allowedModels?: string[];
  allowedEndpoints?: string[];
  organizationId?: string;
  projectId?: string;
}

export interface CreateApiKeyResponse {
  success: boolean;
  apiKey?: {
    id: string;
    fullKey: string; // Only returned once
    keyPrefix: string;
    name: string | null;
    provider: string;
    isActive: boolean;
    createdAt: string;
  };
  error?: string;
}

export interface UpdateApiKeyRequest {
  name?: string;
  providerSelectionStrategy?: 'single' | 'priority' | 'round-robin' | 'least-loaded' | 'cost-optimized';
  requestsPerMinute?: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
  monthlySpendLimitUsd?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ListApiKeysResponse {
  success: boolean;
  apiKeys?: Array<{
    id: string;
    keyPrefix: string;
    name: string | null;
    provider: string;
    isActive: boolean;
    revokedAt: string | null;
    requestsPerMinute: number | null;
    requestsPerDay: number | null;
    tokensPerDay: number | null;
    monthlySpendLimitUsd: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
  error?: string;
}

export interface RevokeApiKeyResponse {
  success: boolean;
  error?: string;
}

// Usage types

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCostUsd: number; // in cents
  modelBreakdown: Record<string, {
    requests: number;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  }>;
}

export interface UsageDailyStats {
  date: string;
  requests: number;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
}

export interface UsageRecentRequest {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  model: string;
  statusCode: number;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  latencyMs: number | null;
  errorMessage: string | null;
}

export interface UsageQueryParams {
  apiKeyId?: string;
  startDate?: string;
  endDate?: string;
  model?: string;
}

export interface UsageResponse {
  success: boolean;
  usage?: UsageStats & {
    quotaRemaining: {
      requestsPerMinute: number | null;
      requestsPerDay: number | null;
      tokensPerDay: number | null;
    };
    quotaLimits: {
      requestsPerMinute: number | null;
      requestsPerDay: number | null;
      tokensPerDay: number | null;
    };
    dailyUsage?: UsageDailyStats[];
    recentRequests?: UsageRecentRequest[];
  };
  error?: string;
}

// Proxy types

export interface ProxyRequest {
  method: string;
  path: string;
  headers: Headers;
  body?: unknown;
}

export interface ProxyResponse {
  status: number;
  headers: Headers;
  body: ReadableStream | string;
}

// Rate limit types

export interface RateLimitResult {
  allowed: boolean;
  limit?: number;
  remaining?: number;
  reset?: number; // Unix timestamp
  retryAfter?: number; // seconds
}

// Error types

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class RateLimitError extends ApiError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter: number
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class QuotaExceededError extends ApiError {
  constructor(message: string = 'Quota exceeded') {
    super(message, 429, 'QUOTA_EXCEEDED');
    this.name = 'QuotaExceededError';
  }
}
