import crypto from 'crypto';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Sends a webhook notification
 * @param url - Webhook URL
 * @param payload - Event payload
 * @param secret - Optional webhook secret for signing
 * @returns Success status
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  secret?: string
): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Conduit-Webhook/1.0',
    };

    // Sign the payload if secret is provided
    if (secret) {
      const signature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      headers['X-Webhook-Signature'] = signature;
      headers['X-Webhook-Timestamp'] = payload.timestamp;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    return response.ok;
  } catch (error) {
    console.error('Webhook sending error:', error);
    return false;
  }
}

/**
 * Sends a quota warning webhook
 */
export async function sendQuotaWarningWebhook(
  webhookUrl: string,
  apiKeyId: string,
  keyName: string,
  quotaType: string,
  currentUsage: number,
  limit: number,
  percentage: number
): Promise<boolean> {
  const payload: WebhookPayload = {
    event: 'quota.warning',
    timestamp: new Date().toISOString(),
    data: {
      apiKeyId,
      keyName,
      quotaType,
      currentUsage,
      limit,
      percentage,
    },
  };

  return await sendWebhook(webhookUrl, payload);
}

/**
 * Sends a spend limit webhook
 */
export async function sendSpendLimitWebhook(
  webhookUrl: string,
  apiKeyId: string,
  keyName: string,
  currentSpend: number,
  limit: number,
  percentage: number
): Promise<boolean> {
  const payload: WebhookPayload = {
    event: 'spend.alert',
    timestamp: new Date().toISOString(),
    data: {
      apiKeyId,
      keyName,
      currentSpendUsd: currentSpend / 100,
      limitUsd: limit / 100,
      percentage,
    },
  };

  return await sendWebhook(webhookUrl, payload);
}

/**
 * Sends an API key expiration webhook
 */
export async function sendKeyExpirationWebhook(
  webhookUrl: string,
  apiKeyId: string,
  keyName: string,
  expiresAt: Date
): Promise<boolean> {
  const daysUntilExpiry = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const payload: WebhookPayload = {
    event: 'key.expiring',
    timestamp: new Date().toISOString(),
    data: {
      apiKeyId,
      keyName,
      expiresAt: expiresAt.toISOString(),
      daysUntilExpiry,
    },
  };

  return await sendWebhook(webhookUrl, payload);
}

/**
 * Sends an API key rotated webhook
 */
export async function sendKeyRotatedWebhook(
  webhookUrl: string,
  apiKeyId: string,
  keyName: string,
  rotatedBy: string
): Promise<boolean> {
  const payload: WebhookPayload = {
    event: 'key.rotated',
    timestamp: new Date().toISOString(),
    data: {
      apiKeyId,
      keyName,
      rotatedBy,
    },
  };

  return await sendWebhook(webhookUrl, payload);
}

/**
 * Sends an API key revoked webhook
 */
export async function sendKeyRevokedWebhook(
  webhookUrl: string,
  apiKeyId: string,
  keyName: string,
  revokedBy: string
): Promise<boolean> {
  const payload: WebhookPayload = {
    event: 'key.revoked',
    timestamp: new Date().toISOString(),
    data: {
      apiKeyId,
      keyName,
      revokedBy,
    },
  };

  return await sendWebhook(webhookUrl, payload);
}
