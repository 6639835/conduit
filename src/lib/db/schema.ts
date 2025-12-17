import { pgTable, uuid, varchar, text, timestamp, integer, bigint, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

// Admin users table (minimal - only for dashboard access)
export const admins = pgTable('admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Providers table (centralized Claude API provider configuration)
export const providers = pgTable('providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('official'), // 'official', 'bedrock', 'custom'
  endpoint: text('endpoint').notNull(),
  apiKey: text('api_key').notNull(), // Encrypted Claude API key

  // Status
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  status: varchar('status', { length: 20 }).default('unknown'), // 'healthy', 'unhealthy', 'unknown'
  lastTestedAt: timestamp('last_tested_at'),

  // Default rate limits for API keys using this provider
  defaultRateLimits: jsonb('default_rate_limits').notNull().default({
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    tokensPerDay: 1000000,
  }),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('providers_name_idx').on(table.name),
  isActiveIdx: index('providers_is_active_idx').on(table.isActive),
  isDefaultIdx: index('providers_is_default_idx').on(table.isDefault),
}));

// API keys table
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  keyHash: text('key_hash').notNull().unique(), // SHA-256 hash of the key
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // First 8 chars for display (e.g., "sk-cond_abc123...")
  name: varchar('name', { length: 255 }), // Optional friendly name

  // Configuration - references centralized providers table
  providerId: uuid('provider_id').references(() => providers.id).notNull(),

  // Legacy fields for backward compatibility (deprecated - use providerId instead)
  provider: varchar('provider', { length: 50 }), // Legacy: 'official' or 'bedrock'
  targetApiKey: text('target_api_key'), // Legacy: Encrypted Claude API key

  // Quotas
  requestsPerMinute: integer('requests_per_minute').default(60),
  requestsPerDay: integer('requests_per_day').default(1000),
  tokensPerDay: bigint('tokens_per_day', { mode: 'number' }).default(1000000),
  monthlySpendLimitUsd: integer('monthly_spend_limit_usd'), // In cents

  // Status
  isActive: boolean('is_active').notNull().default(true),
  revokedAt: timestamp('revoked_at'),

  // Metadata
  metadata: jsonb('metadata'), // For custom tags, notes, etc.
  createdBy: uuid('created_by').references(() => admins.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  keyHashIdx: uniqueIndex('key_hash_idx').on(table.keyHash),
  keyPrefixIdx: index('key_prefix_idx').on(table.keyPrefix),
  isActiveIdx: index('is_active_idx').on(table.isActive),
  providerIdIdx: index('provider_id_idx').on(table.providerId),
}));

// Usage logs table (partitioned by date for performance)
export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id).notNull(),

  // Request details
  method: varchar('method', { length: 10 }).notNull(), // POST, GET, etc.
  path: text('path').notNull(), // /v1/messages, /v1/complete, etc.
  model: varchar('model', { length: 100 }).notNull(), // claude-3-5-sonnet-20241022

  // Usage metrics
  tokensInput: integer('tokens_input').notNull().default(0),
  tokensOutput: integer('tokens_output').notNull().default(0),

  // Cost calculation
  costUsd: integer('cost_usd').notNull().default(0), // In cents

  // Timing
  latencyMs: integer('latency_ms'),

  // Status
  statusCode: integer('status_code').notNull(),
  errorMessage: text('error_message'),

  // Metadata
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  country: varchar('country', { length: 2 }),

  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  apiKeyIdIdx: index('usage_logs_api_key_id_idx').on(table.apiKeyId),
  timestampIdx: index('usage_logs_timestamp_idx').on(table.timestamp),
  modelIdx: index('usage_logs_model_idx').on(table.model),
  compositeIdx: index('usage_logs_composite_idx').on(table.apiKeyId, table.timestamp),
}));

// Aggregated usage (materialized view, updated hourly/daily)
export const usageAggregates = pgTable('usage_aggregates', {
  id: uuid('id').defaultRandom().primaryKey(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id).notNull(),

  period: varchar('period', { length: 20 }).notNull(), // 'hour', 'day', 'month'
  periodStart: timestamp('period_start').notNull(),

  // Aggregated metrics
  totalRequests: integer('total_requests').notNull().default(0),
  successfulRequests: integer('successful_requests').notNull().default(0),
  failedRequests: integer('failed_requests').notNull().default(0),

  totalTokensInput: bigint('total_tokens_input', { mode: 'number' }).notNull().default(0),
  totalTokensOutput: bigint('total_tokens_output', { mode: 'number' }).notNull().default(0),

  totalCostUsd: bigint('total_cost_usd', { mode: 'number' }).notNull().default(0), // In cents

  // Model breakdown (JSONB for flexibility)
  modelBreakdown: jsonb('model_breakdown'), // { "claude-3-5-sonnet": { requests: 100, tokens: 50000 } }

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniquePeriod: uniqueIndex('usage_aggregates_unique_period').on(table.apiKeyId, table.period, table.periodStart),
  periodStartIdx: index('usage_aggregates_period_start_idx').on(table.periodStart),
}));

// Rate limit tracking (optional DB fallback if KV unavailable)
export const rateLimitCounters = pgTable('rate_limit_counters', {
  id: uuid('id').defaultRandom().primaryKey(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id).notNull(),
  window: varchar('window', { length: 20 }).notNull(), // 'minute', 'day'
  windowStart: timestamp('window_start').notNull(),
  count: integer('count').notNull().default(0),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  uniqueWindow: uniqueIndex('rate_limit_counters_unique_window').on(table.apiKeyId, table.window, table.windowStart),
  expiresAtIdx: index('rate_limit_counters_expires_at_idx').on(table.expiresAt),
}));

// Type exports for TypeScript
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;

export type UsageAggregate = typeof usageAggregates.$inferSelect;
export type NewUsageAggregate = typeof usageAggregates.$inferInsert;

export type RateLimitCounter = typeof rateLimitCounters.$inferSelect;
export type NewRateLimitCounter = typeof rateLimitCounters.$inferInsert;

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
