/**
 * Slack Notifications Plugin
 * Send notifications to Slack for important events
 */

import { Plugin, PluginCategory, ErrorContext, ApiKeyInfo } from '../types';

export const slackNotificationsPlugin: Plugin = {
  id: 'slack-notifications',
  name: 'Slack Notifications',
  version: '1.0.0',
  description: 'Send notifications to Slack channels for errors, quota warnings, and key events',
  author: {
    name: 'Conduit Team',
    email: 'plugins@conduit.dev',
  },
  category: PluginCategory.NOTIFICATION,
  tags: ['slack', 'notifications', 'alerts', 'monitoring'],
  icon: 'https://cdn.simpleicons.org/slack',
  isOfficial: true,
  isInstalled: false,
  isEnabled: false,
  config: {
    webhookUrl: '',
    notifyOnError: true,
    notifyOnKeyCreated: false,
    notifyOnKeyRevoked: true,
    errorThreshold: 5, // Number of errors before notification
  },
  hooks: {
    async onError(context: ErrorContext) {
      const config = slackNotificationsPlugin.config as Partial<{
        webhookUrl: unknown;
        notifyOnError: unknown;
        errorThreshold: unknown;
      }>;

      const webhookUrl = typeof config.webhookUrl === 'string' ? config.webhookUrl : '';
      const notifyOnError = typeof config.notifyOnError === 'boolean' ? config.notifyOnError : false;
      const errorThreshold = typeof config.errorThreshold === 'number' ? config.errorThreshold : 5;

      if (!notifyOnError || !webhookUrl) {
        return context;
      }

      const errorCount = await getErrorCount(context.apiKeyId);

      if (errorCount >= errorThreshold) {
        await sendSlackMessage(webhookUrl, {
          text: `🚨 Error Alert`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Error in API Request*\n\nAPI Key: ${context.apiKeyId}\nError: ${context.error.message}\nStatus: ${context.statusCode}`,
              },
            },
          ],
        });
      }

      return context;
    },

    async onApiKeyCreated(apiKey: ApiKeyInfo) {
      const config = slackNotificationsPlugin.config as Partial<{
        webhookUrl: unknown;
        notifyOnKeyCreated: unknown;
      }>;

      const webhookUrl = typeof config.webhookUrl === 'string' ? config.webhookUrl : '';
      const notifyOnKeyCreated =
        typeof config.notifyOnKeyCreated === 'boolean' ? config.notifyOnKeyCreated : false;

      if (!notifyOnKeyCreated || !webhookUrl) {
        return;
      }

      await sendSlackMessage(webhookUrl, {
        text: `🔑 New API Key Created`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New API Key Created*\n\nName: ${apiKey.name || 'Unnamed'}\nPrefix: ${apiKey.keyPrefix}\nOrganization: ${apiKey.organizationId || 'None'}`,
            },
          },
        ],
      });
    },

    async onApiKeyRevoked(apiKey: ApiKeyInfo) {
      const config = slackNotificationsPlugin.config as Partial<{
        webhookUrl: unknown;
        notifyOnKeyRevoked: unknown;
      }>;

      const webhookUrl = typeof config.webhookUrl === 'string' ? config.webhookUrl : '';
      const notifyOnKeyRevoked =
        typeof config.notifyOnKeyRevoked === 'boolean' ? config.notifyOnKeyRevoked : false;

      if (!notifyOnKeyRevoked || !webhookUrl) {
        return;
      }

      await sendSlackMessage(webhookUrl, {
        text: `⚠️ API Key Revoked`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*API Key Revoked*\n\nName: ${apiKey.name || 'Unnamed'}\nPrefix: ${apiKey.keyPrefix}`,
            },
          },
        ],
      });
    },
  },
  repository: 'https://github.com/conduit/plugins/tree/main/slack-notifications',
  license: 'MIT',
  downloads: 1250,
  rating: 4.8,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-12-01'),
};

async function sendSlackMessage(webhookUrl: string, message: Record<string, unknown>): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}

async function getErrorCount(_apiKeyId: string): Promise<number> {
  // In production, query error count from database
  return 0;
}
