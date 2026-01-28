/**
 * Advanced Request Logger Plugin
 * Enhanced logging with custom formatting and external storage
 */

import { Plugin, PluginCategory, ResponseContext, RequestMetrics } from '../types';

export const requestLoggerPlugin: Plugin = {
  id: 'advanced-request-logger',
  name: 'Advanced Request Logger',
  version: '1.0.0',
  description: 'Log requests to external services like Datadog, New Relic, or custom endpoints',
  author: {
    name: 'Conduit Team',
    email: 'plugins@conduit.dev',
  },
  category: PluginCategory.LOGGING,
  tags: ['logging', 'monitoring', 'observability', 'datadog', 'newrelic'],
  icon: '📊',
  isOfficial: true,
  isInstalled: false,
  isEnabled: false,
  config: {
    endpoint: '',
    apiKey: '',
    logLevel: 'info',
    includePrompt: false,
    includeResponse: false,
    batchSize: 10,
    batchIntervalMs: 5000,
  },
  hooks: {
    async onRequestComplete(metrics: RequestMetrics) {
      const config = requestLoggerPlugin.config as Partial<{
        endpoint: unknown;
        apiKey: unknown;
      }>;

      const endpoint = typeof config.endpoint === 'string' ? config.endpoint : '';
      const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';

      if (!endpoint || !apiKey) {
        return;
      }

      const logEntry = {
        timestamp: metrics.timestamp.toISOString(),
        requestId: metrics.requestId,
        apiKeyId: metrics.apiKeyId,
        providerId: metrics.providerId,
        model: metrics.model,
        statusCode: metrics.statusCode,
        latencyMs: metrics.latencyMs,
        promptTokens: metrics.promptTokens,
        completionTokens: metrics.completionTokens,
        cost: metrics.cost,
      };

      await sendToExternalLogger(endpoint, apiKey, logEntry);
    },

    async onAfterProviderCall(context: ResponseContext) {
      console.log(
        `[Plugin] Request ${context.requestId} completed in ${context.latencyMs}ms`
      );

      return context;
    },
  },
  repository: 'https://github.com/conduit/plugins/tree/main/request-logger',
  license: 'MIT',
  downloads: 850,
  rating: 4.5,
  createdAt: new Date('2024-02-20'),
  updatedAt: new Date('2024-11-15'),
};

async function sendToExternalLogger(
  endpoint: string,
  apiKey: string,
  logEntry: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(logEntry),
    });
  } catch (error) {
    console.error('Failed to send log to external service:', error);
  }
}
