/**
 * Email notification service
 * Supports multiple email providers via environment variables
 */

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Sends an email notification
 * @param params - Email parameters
 * @returns Success status
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';

  try {
    switch (provider) {
      case 'resend':
        return await sendViaResend(params);
      case 'sendgrid':
        return await sendViaSendGrid(params);
      case 'smtp':
      default:
        return await sendViaSmtp(params);
    }
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

/**
 * Sends email via Resend API
 */
async function sendViaResend(params: EmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'noreply@conduit.dev';

  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  return response.ok;
}

/**
 * Sends email via SendGrid API
 */
async function sendViaSendGrid(params: EmailParams): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'noreply@conduit.dev';

  if (!apiKey) {
    console.error('SENDGRID_API_KEY not configured');
    return false;
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: fromEmail },
      subject: params.subject,
      content: [
        { type: 'text/html', value: params.html },
        ...(params.text ? [{ type: 'text/plain', value: params.text }] : []),
      ],
    }),
  });

  return response.ok;
}

/**
 * Sends email via SMTP (placeholder - requires nodemailer in production)
 */
async function sendViaSmtp(params: EmailParams): Promise<boolean> {
  // In production, you would use nodemailer or a similar library
  // For now, just log the email
  console.log('SMTP Email (not configured):', {
    to: params.to,
    subject: params.subject,
  });

  return true; // Return true for development
}

/**
 * Sends a quota warning email
 */
export async function sendQuotaWarningEmail(
  email: string,
  keyName: string,
  quotaType: string,
  percentage: number
): Promise<boolean> {
  const subject = `⚠️ Quota Warning: ${quotaType} at ${percentage}%`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">Quota Warning</h2>
      <p>Your API key <strong>${keyName}</strong> has reached <strong>${percentage}%</strong> of its ${quotaType} quota.</p>
      <p>Please monitor your usage or increase your quota limits to avoid service interruptions.</p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated notification from Conduit API Gateway.
      </p>
    </div>
  `;
  const text = `Quota Warning: Your API key "${keyName}" has reached ${percentage}% of its ${quotaType} quota.`;

  return await sendEmail({ to: email, subject, html, text });
}

/**
 * Sends a spend limit warning email
 */
export async function sendSpendLimitEmail(
  email: string,
  keyName: string,
  currentSpend: number,
  limit: number
): Promise<boolean> {
  const percentage = Math.round((currentSpend / limit) * 100);
  const subject = `💰 Spend Alert: ${percentage}% of monthly limit reached`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ef4444;">Spend Alert</h2>
      <p>Your API key <strong>${keyName}</strong> has used <strong>$${(
    currentSpend / 100
  ).toFixed(2)}</strong> of your <strong>$${(limit / 100).toFixed(
    2
  )}</strong> monthly limit.</p>
      <p>That's <strong>${percentage}%</strong> of your allocated budget.</p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated notification from Conduit API Gateway.
      </p>
    </div>
  `;

  const text = `Spend Alert: Your API key "${keyName}" has used $${(
    currentSpend / 100
  ).toFixed(2)} of your $${(limit / 100).toFixed(2)} monthly limit (${percentage}%).`;

  return await sendEmail({ to: email, subject, html, text });
}

/**
 * Sends an API key expiration warning
 */
export async function sendKeyExpirationEmail(
  email: string,
  keyName: string,
  expiresAt: Date
): Promise<boolean> {
  const daysUntilExpiry = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const subject = `🔑 API Key Expiring Soon: ${keyName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">API Key Expiration Notice</h2>
      <p>Your API key <strong>${keyName}</strong> will expire in <strong>${daysUntilExpiry} day(s)</strong>.</p>
      <p>Expiration date: <strong>${expiresAt.toLocaleDateString()}</strong></p>
      <p>Please rotate or extend your API key to avoid service interruptions.</p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated notification from Conduit API Gateway.
      </p>
    </div>
  `;

  const text = `API Key Expiration: Your key "${keyName}" will expire in ${daysUntilExpiry} days on ${expiresAt.toLocaleDateString()}.`;

  return await sendEmail({ to: email, subject, html, text });
}
