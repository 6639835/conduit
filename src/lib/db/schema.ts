import { pgTable, uuid, varchar, text, timestamp, integer, bigint, boolean, jsonb, index, uniqueIndex, decimal } from 'drizzle-orm/pg-core';

// Admin users table (minimal - only for dashboard access)
export const admins = pgTable('admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),

  // Two-factor authentication
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  twoFactorSecret: text('two_factor_secret'), // Encrypted TOTP secret

  // Role-based access control
  role: varchar('role', { length: 50 }).notNull().default('admin'), // 'super_admin', 'admin', 'viewer'
  permissions: jsonb('permissions'), // Array of permission strings

  // Organization association
  organizationId: uuid('organization_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Providers table (centralized model provider configuration)
export const providers = pgTable('providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('official'), // 'official', 'bedrock', 'custom', 'codex', 'openai', 'gemini'
  endpoint: text('endpoint').notNull(),
  apiKey: text('api_key').notNull(), // Encrypted provider credential (API key or OAuth token)

  // Multi-region support
  region: varchar('region', { length: 50 }), // e.g., 'us-east-1', 'eu-west-1', 'ap-southeast-1'
  model: varchar('model', { length: 100 }), // e.g., 'claude-sonnet-4', 'gpt-4o', 'gemini-1.5-pro'

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

  // Caching configuration
  cacheEnabled: boolean('cache_enabled').notNull().default(false),
  cacheTtlSeconds: integer('cache_ttl_seconds').default(300), // 5 minutes default

  // Failover & load balancing
  priority: integer('priority').notNull().default(0), // Higher priority = preferred provider
  failoverEnabled: boolean('failover_enabled').notNull().default(true),
  maxRetries: integer('max_retries').notNull().default(3),

  // Cost optimization
  costMultiplier: decimal('cost_multiplier', { precision: 10, scale: 2 }).notNull().default('1.00'), // For cost-optimized strategy (1.0 = baseline, 0.8 = 20% cheaper)

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('providers_name_idx').on(table.name),
  isActiveIdx: index('providers_is_active_idx').on(table.isActive),
  isDefaultIdx: index('providers_is_default_idx').on(table.isDefault),
  priorityIdx: index('providers_priority_idx').on(table.priority),
  regionIdx: index('providers_region_idx').on(table.region),
  // Note: Only one provider should be default at a time, but this is enforced at application level
}));

// API Key Providers junction table (many-to-many relationship)
export const apiKeyProviders = pgTable('api_key_providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'cascade' }).notNull(),
  providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'cascade' }).notNull(),
  priority: integer('priority').notNull().default(0), // Per-key provider priority
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniquePair: uniqueIndex('api_key_providers_unique_pair').on(table.apiKeyId, table.providerId),
  apiKeyIdIdx: index('api_key_providers_api_key_id_idx').on(table.apiKeyId),
  providerIdIdx: index('api_key_providers_provider_id_idx').on(table.providerId),
}));

// API keys table
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  keyHash: text('key_hash').notNull().unique(), // SHA-256 hash of the key
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // First 12 chars for display (e.g., "sk-cond_abc")
  name: varchar('name', { length: 255 }), // Optional friendly name

  // Configuration - references centralized providers table with cascade delete
  providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'restrict' }).notNull(),

  // Provider selection strategy for multi-provider support
  providerSelectionStrategy: varchar('provider_selection_strategy', { length: 30 }).notNull().default('single'), // 'single', 'priority', 'round-robin', 'least-loaded', 'cost-optimized'

  // Multi-tenancy
  organizationId: uuid('organization_id'),
  projectId: uuid('project_id'),

  // Legacy fields for backward compatibility (deprecated - will be removed in future version)
  // These fields are no longer used - all API keys should use providerId
  provider: varchar('provider', { length: 50 }), // DEPRECATED: Use providerId instead
  targetApiKey: text('target_api_key'), // DEPRECATED: API key now stored in providers table

  // Quotas
  requestsPerMinute: integer('requests_per_minute').default(60),
  requestsPerDay: integer('requests_per_day').default(1000),
  tokensPerDay: bigint('tokens_per_day', { mode: 'number' }).default(1000000),
  monthlySpendLimitUsd: integer('monthly_spend_limit_usd'), // In USD (e.g., 10 = $10.00)

  // Model-specific rate limits
  modelRateLimits: jsonb('model_rate_limits'), // { "claude-3-5-sonnet": { requestsPerMinute: 10 } }

  // Key rotation and expiration
  expiresAt: timestamp('expires_at'),
  lastRotatedAt: timestamp('last_rotated_at'),
  rotationCount: integer('rotation_count').notNull().default(0),

  // Scoping - restrict what this key can access
  scopes: jsonb('scopes'), // { models: ["claude-3-5-sonnet"], endpoints: ["/v1/messages"] }
  permissions: jsonb('permissions'), // Array of permission strings

  // IP security
  ipWhitelist: jsonb('ip_whitelist'), // Array of allowed IP addresses/CIDR ranges
  ipBlacklist: jsonb('ip_blacklist'), // Array of blocked IP addresses/CIDR ranges

  // Request signing (HMAC)
  hmacEnabled: boolean('hmac_enabled').notNull().default(false),
  hmacSecret: text('hmac_secret'), // Encrypted HMAC secret for request signing

  // Two-factor authentication
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  totpSecret: text('totp_secret'), // Encrypted TOTP secret for 2FA

  // Notification settings
  emailNotificationsEnabled: boolean('email_notifications_enabled').notNull().default(false),
  notificationEmail: varchar('notification_email', { length: 255 }),
  webhookUrl: text('webhook_url'), // Custom webhook for notifications
  slackWebhook: text('slack_webhook'),
  discordWebhook: text('discord_webhook'),

  // Alert thresholds (percentage-based)
  alertThresholds: jsonb('alert_thresholds').default({
    requestsPerDay: [80, 90],
    tokensPerDay: [80, 90],
    monthlySpend: [80, 90],
  }),

  // Response transformation rules
  transformationRules: jsonb('transformation_rules'), // Array of TransformationRule objects

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
  organizationIdIdx: index('organization_id_idx').on(table.organizationId),
  projectIdIdx: index('project_id_idx').on(table.projectId),
  expiresAtIdx: index('expires_at_idx').on(table.expiresAt),
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
  costUsd: integer('cost_usd').notNull().default(0), // In USD cents (e.g., 150 = $1.50)

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

// Request logs table (detailed request-level analytics)
export const requestLogs = pgTable('request_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id).notNull(),
  providerId: uuid('provider_id').references(() => providers.id),

  method: varchar('method', { length: 10 }).notNull(),
  endpoint: text('endpoint').notNull(),
  model: varchar('model', { length: 100 }).notNull(),

  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  cost: integer('cost').notNull().default(0),

  latencyMs: integer('latency_ms'),
  statusCode: integer('status_code').notNull(),
  errorMessage: text('error_message'),

  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  apiKeyIdIdx: index('request_logs_api_key_id_idx').on(table.apiKeyId),
  providerIdIdx: index('request_logs_provider_id_idx').on(table.providerId),
  createdAtIdx: index('request_logs_created_at_idx').on(table.createdAt),
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

  totalCostUsd: bigint('total_cost_usd', { mode: 'number' }).notNull().default(0), // In USD cents (e.g., 5000 = $50.00)

  // Model breakdown (JSONB for flexibility)
  modelBreakdown: jsonb('model_breakdown'), // { "claude-3-5-sonnet": { requests: 100, tokens: 50000 } }

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniquePeriod: uniqueIndex('usage_aggregates_unique_period').on(table.apiKeyId, table.period, table.periodStart),
  periodStartIdx: index('usage_aggregates_period_start_idx').on(table.periodStart),
}));

// Notifications table for in-app notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').references(() => admins.id),

  // Notification content
  type: varchar('type', { length: 50 }).notNull(), // 'info', 'warning', 'error', 'success'
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),

  // Optional link for actionable notifications
  actionUrl: text('action_url'),
  actionLabel: varchar('action_label', { length: 100 }),

  // Status
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),

  // Metadata
  metadata: jsonb('metadata'), // For extra context like apiKeyId, providerId, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  adminIdIdx: index('notifications_admin_id_idx').on(table.adminId),
  isReadIdx: index('notifications_is_read_idx').on(table.isRead),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
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

// Organizations table (multi-tenancy)
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),

  // Subscription & limits
  plan: varchar('plan', { length: 50 }).notNull().default('free'), // 'free', 'pro', 'enterprise'
  maxApiKeys: integer('max_api_keys').default(10),
  maxUsers: integer('max_users').default(5),

  // Shared quotas
  sharedQuotas: jsonb('shared_quotas'), // Organization-wide quotas

  // Settings
  settings: jsonb('settings'), // Organization-specific settings

  // SSO/SAML Configuration
  ssoEnabled: boolean('sso_enabled').notNull().default(false),
  ssoProvider: varchar('sso_provider', { length: 50 }), // 'saml', 'oauth-google', 'oauth-github', 'oauth-azure'
  ssoConfig: jsonb('sso_config'), // Provider-specific SSO configuration
  // For SAML: { entityId, ssoUrl, certificate, signRequests, encryptAssertions }
  // For OAuth: { clientId, clientSecret (encrypted), authorizeUrl, tokenUrl, scopes }

  // Data Retention & Compliance
  retentionPolicyDays: integer('retention_policy_days'), // null = no retention, number = days to retain
  gdprCompliant: boolean('gdpr_compliant').notNull().default(false),
  ccpaCompliant: boolean('ccpa_compliant').notNull().default(false),

  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
  isActiveIdx: index('organizations_is_active_idx').on(table.isActive),
}));

// Projects table (for grouping API keys)
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Shared quotas across keys in this project
  sharedQuotas: jsonb('shared_quotas'), // { requestsPerDay: 10000, tokensPerDay: 5000000 }

  // Settings
  settings: jsonb('settings'),

  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => admins.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index('projects_organization_id_idx').on(table.organizationId),
  isActiveIdx: index('projects_is_active_idx').on(table.isActive),
}));

// Audit logs table (detailed change tracking)
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Who performed the action
  adminId: uuid('admin_id').references(() => admins.id),
  adminEmail: varchar('admin_email', { length: 255 }),

  // What was affected
  resourceType: varchar('resource_type', { length: 50 }).notNull(), // 'api_key', 'provider', 'admin', 'organization', etc.
  resourceId: uuid('resource_id'),

  // What happened
  action: varchar('action', { length: 50 }).notNull(), // 'create', 'update', 'delete', 'rotate', 'revoke', etc.
  changes: jsonb('changes'), // { before: {...}, after: {...} }

  // Context
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),

  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  adminIdIdx: index('audit_logs_admin_id_idx').on(table.adminId),
  resourceTypeIdx: index('audit_logs_resource_type_idx').on(table.resourceType),
  resourceIdIdx: index('audit_logs_resource_id_idx').on(table.resourceId),
  timestampIdx: index('audit_logs_timestamp_idx').on(table.timestamp),
  compositeIdx: index('audit_logs_composite_idx').on(table.resourceType, table.resourceId, table.timestamp),
}));

// Response cache table (for caching Claude API responses)
export const responseCache = pgTable('response_cache', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Cache key (hash of request body + model)
  cacheKey: text('cache_key').notNull().unique(),

  // Cached response
  response: jsonb('response').notNull(),

  // Metadata
  model: varchar('model', { length: 100 }).notNull(),
  tokensInput: integer('tokens_input').notNull(),
  tokensOutput: integer('tokens_output').notNull(),

  // TTL
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  cacheKeyIdx: uniqueIndex('response_cache_key_idx').on(table.cacheKey),
  expiresAtIdx: index('response_cache_expires_at_idx').on(table.expiresAt),
}));

// API Key Templates table (for standardized key creation)
export const keyTemplates = pgTable('key_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Template settings (applied to new keys)
  providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'set null' }),
  providerSelectionStrategy: varchar('provider_selection_strategy', { length: 30 }).default('single'),
  providerIds: jsonb('provider_ids'), // Array of {providerId, priority} for multi-provider templates

  // Default quotas
  requestsPerMinute: integer('requests_per_minute').default(60),
  requestsPerDay: integer('requests_per_day').default(1000),
  tokensPerDay: bigint('tokens_per_day', { mode: 'number' }).default(1000000),
  monthlySpendLimitUsd: integer('monthly_spend_limit_usd'),

  // Default security settings
  expiresInDays: integer('expires_in_days'), // Days until expiration (null = no expiration)
  ipWhitelist: jsonb('ip_whitelist'),
  ipBlacklist: jsonb('ip_blacklist'),
  scopes: jsonb('scopes'), // { models: [...], endpoints: [...] }

  // Default alert thresholds
  alertThresholds: jsonb('alert_thresholds').default({
    requestsPerDay: [80, 90],
    tokensPerDay: [80, 90],
    monthlySpend: [80, 90],
  }),

  // Notification settings
  emailNotificationsEnabled: boolean('email_notifications_enabled').default(false),
  webhookUrl: text('webhook_url'),
  slackWebhook: text('slack_webhook'),
  discordWebhook: text('discord_webhook'),

  // Organization association
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  // Metadata
  isActive: boolean('is_active').notNull().default(true),
  usageCount: integer('usage_count').notNull().default(0), // Track how many keys created from this template
  createdBy: uuid('created_by').references(() => admins.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('key_templates_name_idx').on(table.name),
  organizationIdIdx: index('key_templates_organization_id_idx').on(table.organizationId),
  isActiveIdx: index('key_templates_is_active_idx').on(table.isActive),
  createdByIdx: index('key_templates_created_by_idx').on(table.createdBy),
}));

// Webhook Configurations table (for event-driven notifications)
export const webhookConfigurations = pgTable('webhook_configurations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Webhook endpoint
  url: text('url').notNull(),
  secret: text('secret'), // Optional HMAC secret for signature verification

  // Event types to subscribe to
  events: jsonb('events').notNull(), // Array of event types: ['quota.warning', 'key.expired', 'error.rate.spike', etc.]

  // Filtering
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'cascade' }), // Null = all keys
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }), // Null = all orgs

  // Delivery settings
  retryPolicy: jsonb('retry_policy').default({
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
  }),
  timeout: integer('timeout').default(5000), // Milliseconds

  // Headers (for authentication, etc.)
  headers: jsonb('headers'), // Custom HTTP headers

  // Status
  isActive: boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
  lastSuccessAt: timestamp('last_success_at'),
  lastFailureAt: timestamp('last_failure_at'),
  failureCount: integer('failure_count').notNull().default(0),

  // Metadata
  createdBy: uuid('created_by').references(() => admins.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('webhook_configurations_name_idx').on(table.name),
  apiKeyIdIdx: index('webhook_configurations_api_key_id_idx').on(table.apiKeyId),
  organizationIdIdx: index('webhook_configurations_organization_id_idx').on(table.organizationId),
  isActiveIdx: index('webhook_configurations_is_active_idx').on(table.isActive),
  eventsIdx: index('webhook_configurations_events_idx').using('gin', table.events),
}));

// Webhook Delivery Logs (track webhook deliveries)
export const webhookDeliveryLogs = pgTable('webhook_delivery_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  webhookConfigurationId: uuid('webhook_configuration_id').references(() => webhookConfigurations.id, { onDelete: 'cascade' }).notNull(),

  // Event details
  event: varchar('event', { length: 100 }).notNull(), // e.g., 'quota.warning', 'key.expired'
  payload: jsonb('payload').notNull(), // The event data sent

  // Request details
  requestUrl: text('request_url').notNull(),
  requestMethod: varchar('request_method', { length: 10 }).default('POST'),
  requestHeaders: jsonb('request_headers'),
  requestBody: jsonb('request_body'),

  // Response details
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  responseTime: integer('response_time'), // Milliseconds

  // Status
  status: varchar('status', { length: 20 }).notNull(), // 'pending', 'success', 'failed', 'retrying'
  attemptNumber: integer('attempt_number').notNull().default(1),
  errorMessage: text('error_message'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
}, (table) => ({
  webhookIdIdx: index('webhook_delivery_logs_webhook_id_idx').on(table.webhookConfigurationId),
  eventIdx: index('webhook_delivery_logs_event_idx').on(table.event),
  statusIdx: index('webhook_delivery_logs_status_idx').on(table.status),
  createdAtIdx: index('webhook_delivery_logs_created_at_idx').on(table.createdAt),
}));

// Custom Dashboards table (for drag-and-drop dashboard builder)
export const customDashboards = pgTable('custom_dashboards', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Dashboard configuration
  layout: jsonb('layout').notNull(), // Grid layout configuration
  widgets: jsonb('widgets').notNull(), // Array of widget configurations
  /**
   * Widget structure:
   * {
   *   id: string,
   *   type: 'metric' | 'line-chart' | 'bar-chart' | 'donut-chart' | 'table',
   *   title: string,
   *   config: {
   *     // Widget-specific configuration
   *     dataSource: string, // API endpoint or data source
   *     refreshInterval?: number, // Auto-refresh in seconds
   *     filters?: object, // Data filters
   *     ...
   *   },
   *   position: { x: number, y: number, w: number, h: number }
   * }
   */

  // Access control
  visibility: varchar('visibility', { length: 20 }).notNull().default('private'), // 'private', 'organization', 'public'
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  // Sharing
  shareToken: varchar('share_token', { length: 64 }).unique(), // For public sharing
  shareExpiresAt: timestamp('share_expires_at'),

  // Settings
  isDefault: boolean('is_default').notNull().default(false), // Default dashboard for user
  refreshInterval: integer('refresh_interval').default(300), // Auto-refresh in seconds (default 5 min)
  theme: varchar('theme', { length: 20 }).default('light'), // 'light', 'dark', 'auto'

  // Metadata
  createdBy: uuid('created_by').references(() => admins.id).notNull(),
  lastViewedAt: timestamp('last_viewed_at'),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('custom_dashboards_name_idx').on(table.name),
  createdByIdx: index('custom_dashboards_created_by_idx').on(table.createdBy),
  organizationIdIdx: index('custom_dashboards_organization_id_idx').on(table.organizationId),
  visibilityIdx: index('custom_dashboards_visibility_idx').on(table.visibility),
  shareTokenIdx: index('custom_dashboards_share_token_idx').on(table.shareToken),
  isDefaultIdx: index('custom_dashboards_is_default_idx').on(table.isDefault),
}));

// Type exports for TypeScript
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;
export type RequestLog = typeof requestLogs.$inferSelect;
export type NewRequestLog = typeof requestLogs.$inferInsert;

export type UsageAggregate = typeof usageAggregates.$inferSelect;
export type NewUsageAggregate = typeof usageAggregates.$inferInsert;

export type RateLimitCounter = typeof rateLimitCounters.$inferSelect;
export type NewRateLimitCounter = typeof rateLimitCounters.$inferInsert;

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type ResponseCache = typeof responseCache.$inferSelect;
export type NewResponseCache = typeof responseCache.$inferInsert;

export type ApiKeyProvider = typeof apiKeyProviders.$inferSelect;
export type NewApiKeyProvider = typeof apiKeyProviders.$inferInsert;

export type KeyTemplate = typeof keyTemplates.$inferSelect;
export type NewKeyTemplate = typeof keyTemplates.$inferInsert;

export type WebhookConfiguration = typeof webhookConfigurations.$inferSelect;
export type NewWebhookConfiguration = typeof webhookConfigurations.$inferInsert;

export type WebhookDeliveryLog = typeof webhookDeliveryLogs.$inferSelect;
export type NewWebhookDeliveryLog = typeof webhookDeliveryLogs.$inferInsert;

export type CustomDashboard = typeof customDashboards.$inferSelect;
export type NewCustomDashboard = typeof customDashboards.$inferInsert;
