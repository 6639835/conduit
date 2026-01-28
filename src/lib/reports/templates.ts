export type ReportFrequency = 'daily' | 'weekly' | 'monthly';
export type ReportFormat = 'email' | 'slack' | 'discord';

export type SlackTextObject = Record<string, unknown> & {
  type: string;
  text: string;
};

export type SlackBlock = Record<string, unknown> & {
  type: string;
  text?: SlackTextObject;
  fields?: SlackTextObject[];
};

export type SlackMessage = Record<string, unknown> & {
  blocks: SlackBlock[];
};

export type DiscordEmbed = Record<string, unknown> & {
  title?: string;
};

export type DiscordMessage = Record<string, unknown> & {
  embeds: DiscordEmbed[];
};

export interface ReportData {
  period: {
    start: Date;
    end: Date;
    label: string; // e.g., "January 2024", "Week of Jan 15-21"
  };
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalCost: number;
    totalTokens: number;
    activeApiKeys: number;
  };
  topModels: Array<{
    model: string;
    requests: number;
    cost: number;
  }>;
  topApiKeys: Array<{
    keyPrefix: string;
    name: string | null;
    requests: number;
    cost: number;
  }>;
  trends: {
    requestsChange: number; // Percentage change from previous period
    costChange: number;
    avgResponseTime: number;
    errorRate: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
  }>;
}

export interface ReportTemplate {
  frequency: ReportFrequency;
  name: string;
  description: string;
  sections: string[];
  generateSubject: (data: ReportData) => string;
  generateEmailBody: (data: ReportData) => string;
  generateSlackMessage: (data: ReportData) => SlackMessage;
  generateDiscordMessage: (data: ReportData) => DiscordMessage;
}

/**
 * Format currency
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format percentage change
 */
function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Daily Report Template
 */
export const dailyReportTemplate: ReportTemplate = {
  frequency: 'daily',
  name: 'Daily Usage Report',
  description: 'Daily summary of API usage, costs, and performance',
  sections: ['summary', 'top_models', 'alerts'],

  generateSubject: (data) => {
    return `Daily Report: ${data.period.label} - ${formatNumber(data.summary.totalRequests)} requests, ${formatCurrency(data.summary.totalCost)} cost`;
  },

  generateEmailBody: (data) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1e40af; margin-top: 30px; }
    .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .metric-card { background: #f3f4f6; padding: 15px; border-radius: 8px; }
    .metric-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .metric-value { font-size: 24px; font-weight: bold; color: #1f2937; margin-top: 5px; }
    .metric-change { font-size: 14px; margin-top: 5px; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .alert { padding: 12px; border-radius: 6px; margin: 10px 0; }
    .alert-warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .alert-error { background: #fee2e2; border-left: 4px solid #ef4444; }
    .alert-info { background: #dbeafe; border-left: 4px solid #3b82f6; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Daily Usage Report</h1>
    <p><strong>Period:</strong> ${data.period.label}</p>

    <h2>Summary</h2>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Total Requests</div>
        <div class="metric-value">${formatNumber(data.summary.totalRequests)}</div>
        <div class="metric-change ${data.trends.requestsChange >= 0 ? 'positive' : 'negative'}">
          ${formatChange(data.trends.requestsChange)} vs yesterday
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Cost</div>
        <div class="metric-value">${formatCurrency(data.summary.totalCost)}</div>
        <div class="metric-change ${data.trends.costChange <= 0 ? 'positive' : 'negative'}">
          ${formatChange(data.trends.costChange)} vs yesterday
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Success Rate</div>
        <div class="metric-value">${((data.summary.successfulRequests / data.summary.totalRequests) * 100).toFixed(1)}%</div>
        <div class="metric-change">Error rate: ${data.trends.errorRate.toFixed(2)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Active API Keys</div>
        <div class="metric-value">${data.summary.activeApiKeys}</div>
      </div>
    </div>

    ${data.alerts.length > 0 ? `
      <h2>⚠️ Alerts</h2>
      ${data.alerts.map(alert => `
        <div class="alert alert-${alert.type}">
          ${alert.message}
        </div>
      `).join('')}
    ` : ''}

    <h2>Top Models</h2>
    <table>
      <thead>
        <tr>
          <th>Model</th>
          <th>Requests</th>
          <th>Cost</th>
        </tr>
      </thead>
      <tbody>
        ${data.topModels.slice(0, 5).map(model => `
          <tr>
            <td>${model.model}</td>
            <td>${formatNumber(model.requests)}</td>
            <td>${formatCurrency(model.cost)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Top API Keys</h2>
    <table>
      <thead>
        <tr>
          <th>API Key</th>
          <th>Requests</th>
          <th>Cost</th>
        </tr>
      </thead>
      <tbody>
        ${data.topApiKeys.slice(0, 5).map(key => `
          <tr>
            <td><code>${key.keyPrefix}...</code> ${key.name ? `(${key.name})` : ''}</td>
            <td>${formatNumber(key.requests)}</td>
            <td>${formatCurrency(key.cost)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      <p>This is an automated report from Conduit API Gateway.</p>
      <p>Generated at ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  },

  generateSlackMessage: (data) => {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📊 Daily Usage Report',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Period:* ${data.period.label}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Total Requests:*\n${formatNumber(data.summary.totalRequests)} (${formatChange(data.trends.requestsChange)})`,
            },
            {
              type: 'mrkdwn',
              text: `*Total Cost:*\n${formatCurrency(data.summary.totalCost)} (${formatChange(data.trends.costChange)})`,
            },
            {
              type: 'mrkdwn',
              text: `*Success Rate:*\n${((data.summary.successfulRequests / data.summary.totalRequests) * 100).toFixed(1)}%`,
            },
            {
              type: 'mrkdwn',
              text: `*Active Keys:*\n${data.summary.activeApiKeys}`,
            },
          ],
        },
        ...(data.alerts.length > 0
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*⚠️ Alerts:*\n${data.alerts.map(a => `• ${a.message}`).join('\n')}`,
                },
              },
            ]
          : []),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Top Models:*\n${data.topModels.slice(0, 3).map(m => `• ${m.model}: ${formatNumber(m.requests)} req, ${formatCurrency(m.cost)}`).join('\n')}`,
          },
        },
      ],
    };
  },

  generateDiscordMessage: (data) => {
    return {
      embeds: [
        {
          title: '📊 Daily Usage Report',
          description: `Period: ${data.period.label}`,
          color: 0x2563eb,
          fields: [
            {
              name: 'Total Requests',
              value: `${formatNumber(data.summary.totalRequests)} (${formatChange(data.trends.requestsChange)})`,
              inline: true,
            },
            {
              name: 'Total Cost',
              value: `${formatCurrency(data.summary.totalCost)} (${formatChange(data.trends.costChange)})`,
              inline: true,
            },
            {
              name: 'Success Rate',
              value: `${((data.summary.successfulRequests / data.summary.totalRequests) * 100).toFixed(1)}%`,
              inline: true,
            },
            ...(data.alerts.length > 0
              ? [
                  {
                    name: '⚠️ Alerts',
                    value: data.alerts.map(a => a.message).join('\n'),
                    inline: false,
                  },
                ]
              : []),
            {
              name: 'Top Models',
              value: data.topModels
                .slice(0, 3)
                .map(m => `• ${m.model}: ${formatNumber(m.requests)} req`)
                .join('\n'),
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    };
  },
};

/**
 * Weekly Report Template
 */
export const weeklyReportTemplate: ReportTemplate = {
  ...dailyReportTemplate,
  frequency: 'weekly',
  name: 'Weekly Usage Report',
  description: 'Weekly summary of API usage, costs, and performance',

  generateSubject: (data) => {
    return `Weekly Report: ${data.period.label} - ${formatNumber(data.summary.totalRequests)} requests, ${formatCurrency(data.summary.totalCost)} cost`;
  },

  // Email and message generation similar to daily, just change the title
  generateEmailBody: (data) => {
    return dailyReportTemplate.generateEmailBody(data).replace('Daily Usage Report', 'Weekly Usage Report').replace('vs yesterday', 'vs last week');
  },

  generateSlackMessage: (data) => {
    const msg = dailyReportTemplate.generateSlackMessage(data);
    if (msg.blocks[0]?.text) {
      msg.blocks[0].text.text = '📊 Weekly Usage Report';
    }
    return msg;
  },

  generateDiscordMessage: (data) => {
    const msg = dailyReportTemplate.generateDiscordMessage(data);
    msg.embeds[0].title = '📊 Weekly Usage Report';
    return msg;
  },
};

/**
 * Monthly Report Template
 */
export const monthlyReportTemplate: ReportTemplate = {
  ...dailyReportTemplate,
  frequency: 'monthly',
  name: 'Monthly Usage Report',
  description: 'Monthly summary of API usage, costs, and performance',

  generateSubject: (data) => {
    return `Monthly Report: ${data.period.label} - ${formatNumber(data.summary.totalRequests)} requests, ${formatCurrency(data.summary.totalCost)} cost`;
  },

  generateEmailBody: (data) => {
    return dailyReportTemplate.generateEmailBody(data).replace('Daily Usage Report', 'Monthly Usage Report').replace('vs yesterday', 'vs last month');
  },

  generateSlackMessage: (data) => {
    const msg = dailyReportTemplate.generateSlackMessage(data);
    if (msg.blocks[0]?.text) {
      msg.blocks[0].text.text = '📊 Monthly Usage Report';
    }
    return msg;
  },

  generateDiscordMessage: (data) => {
    const msg = dailyReportTemplate.generateDiscordMessage(data);
    msg.embeds[0].title = '📊 Monthly Usage Report';
    return msg;
  },
};

export const reportTemplates = {
  daily: dailyReportTemplate,
  weekly: weeklyReportTemplate,
  monthly: monthlyReportTemplate,
};
