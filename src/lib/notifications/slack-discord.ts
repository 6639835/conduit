/**
 * Slack and Discord notification integration
 */

interface SlackMessage {
  text?: string;
  blocks?: Record<string, unknown>[];
  attachments?: Record<string, unknown>[];
}

interface DiscordMessage {
  content?: string;
  embeds?: Record<string, unknown>[];
}

/**
 * Sends a Slack notification
 * @param webhookUrl - Slack webhook URL
 * @param message - Message to send
 * @returns Success status
 */
export async function sendSlackMessage(
  webhookUrl: string,
  message: SlackMessage
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return response.ok;
  } catch (error) {
    console.error('Slack notification error:', error);
    return false;
  }
}

/**
 * Sends a Discord notification
 * @param webhookUrl - Discord webhook URL
 * @param message - Message to send
 * @returns Success status
 */
export async function sendDiscordMessage(
  webhookUrl: string,
  message: DiscordMessage
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return response.ok;
  } catch (error) {
    console.error('Discord notification error:', error);
    return false;
  }
}

/**
 * Sends a quota warning to Slack
 */
export async function sendSlackQuotaWarning(
  webhookUrl: string,
  keyName: string,
  quotaType: string,
  percentage: number
): Promise<boolean> {
  const color = percentage >= 90 ? '#ef4444' : '#f59e0b';
  const emoji = percentage >= 90 ? ':rotating_light:' : ':warning:';

  const message: SlackMessage = {
    text: `${emoji} Quota Warning`,
    attachments: [
      {
        color,
        fields: [
          {
            title: 'API Key',
            value: keyName,
            short: true,
          },
          {
            title: 'Quota Type',
            value: quotaType,
            short: true,
          },
          {
            title: 'Usage',
            value: `${percentage}%`,
            short: true,
          },
        ],
        footer: 'Conduit API Gateway',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  return await sendSlackMessage(webhookUrl, message);
}

/**
 * Sends a quota warning to Discord
 */
export async function sendDiscordQuotaWarning(
  webhookUrl: string,
  keyName: string,
  quotaType: string,
  percentage: number
): Promise<boolean> {
  const color = percentage >= 90 ? 0xef4444 : 0xf59e0b;
  const emoji = percentage >= 90 ? '🚨' : '⚠️';

  const message: DiscordMessage = {
    embeds: [
      {
        title: `${emoji} Quota Warning`,
        color,
        fields: [
          {
            name: 'API Key',
            value: keyName,
            inline: true,
          },
          {
            name: 'Quota Type',
            value: quotaType,
            inline: true,
          },
          {
            name: 'Usage',
            value: `${percentage}%`,
            inline: true,
          },
        ],
        footer: {
          text: 'Conduit API Gateway',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return await sendDiscordMessage(webhookUrl, message);
}

/**
 * Sends a spend alert to Slack
 */
export async function sendSlackSpendAlert(
  webhookUrl: string,
  keyName: string,
  currentSpend: number,
  limit: number,
  percentage: number
): Promise<boolean> {
  const color = percentage >= 90 ? '#ef4444' : '#f59e0b';

  const message: SlackMessage = {
    text: ':money_with_wings: Spend Alert',
    attachments: [
      {
        color,
        fields: [
          {
            title: 'API Key',
            value: keyName,
            short: true,
          },
          {
            title: 'Current Spend',
            value: `$${(currentSpend / 100).toFixed(2)}`,
            short: true,
          },
          {
            title: 'Monthly Limit',
            value: `$${(limit / 100).toFixed(2)}`,
            short: true,
          },
          {
            title: 'Usage',
            value: `${percentage}%`,
            short: true,
          },
        ],
        footer: 'Conduit API Gateway',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  return await sendSlackMessage(webhookUrl, message);
}

/**
 * Sends a spend alert to Discord
 */
export async function sendDiscordSpendAlert(
  webhookUrl: string,
  keyName: string,
  currentSpend: number,
  limit: number,
  percentage: number
): Promise<boolean> {
  const color = percentage >= 90 ? 0xef4444 : 0xf59e0b;

  const message: DiscordMessage = {
    embeds: [
      {
        title: '💰 Spend Alert',
        color,
        fields: [
          {
            name: 'API Key',
            value: keyName,
            inline: true,
          },
          {
            name: 'Current Spend',
            value: `$${(currentSpend / 100).toFixed(2)}`,
            inline: true,
          },
          {
            name: 'Monthly Limit',
            value: `$${(limit / 100).toFixed(2)}`,
            inline: true,
          },
          {
            name: 'Usage',
            value: `${percentage}%`,
            inline: true,
          },
        ],
        footer: {
          text: 'Conduit API Gateway',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return await sendDiscordMessage(webhookUrl, message);
}

/**
 * Sends a key expiration notice to Slack
 */
export async function sendSlackKeyExpiration(
  webhookUrl: string,
  keyName: string,
  expiresAt: Date
): Promise<boolean> {
  const daysUntilExpiry = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const message: SlackMessage = {
    text: ':key: API Key Expiring Soon',
    attachments: [
      {
        color: '#f59e0b',
        fields: [
          {
            title: 'API Key',
            value: keyName,
            short: true,
          },
          {
            title: 'Days Until Expiry',
            value: daysUntilExpiry.toString(),
            short: true,
          },
          {
            title: 'Expiration Date',
            value: expiresAt.toLocaleDateString(),
            short: false,
          },
        ],
        footer: 'Conduit API Gateway',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  return await sendSlackMessage(webhookUrl, message);
}

/**
 * Sends a key expiration notice to Discord
 */
export async function sendDiscordKeyExpiration(
  webhookUrl: string,
  keyName: string,
  expiresAt: Date
): Promise<boolean> {
  const daysUntilExpiry = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const message: DiscordMessage = {
    embeds: [
      {
        title: '🔑 API Key Expiring Soon',
        color: 0xf59e0b,
        fields: [
          {
            name: 'API Key',
            value: keyName,
            inline: true,
          },
          {
            name: 'Days Until Expiry',
            value: daysUntilExpiry.toString(),
            inline: true,
          },
          {
            name: 'Expiration Date',
            value: expiresAt.toLocaleDateString(),
            inline: false,
          },
        ],
        footer: {
          text: 'Conduit API Gateway',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return await sendDiscordMessage(webhookUrl, message);
}
