import { Tour } from './tour-provider';

export const onboardingTour: Tour = {
  id: 'onboarding',
  name: 'Getting Started with Conduit',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Conduit API Gateway! 👋',
      content: 'Conduit is your production-ready API gateway for Claude, OpenAI, and Gemini. This quick tour will help you get started in minutes.',
    },
    {
      id: 'dashboard',
      title: 'Dashboard Overview',
      content: 'This is your dashboard where you can see quick stats, recent activity, and access all features. Start here to get an overview of your API usage.',
    },
    {
      id: 'providers',
      title: 'Configure Providers',
      content: 'Before creating API keys, you need to configure at least one provider (Claude, OpenAI, or Gemini). Go to Providers to add your API credentials.',
    },
    {
      id: 'create-key',
      title: 'Create Your First API Key',
      content: 'Once providers are configured, create an API key with custom rate limits and quotas. You can create keys individually or use templates for bulk creation.',
    },
    {
      id: 'monitor',
      title: 'Monitor Usage',
      content: 'Track real-time quota usage, view request logs, and get alerts when approaching limits. Click the chart icon on any key to see live usage.',
    },
    {
      id: 'analytics',
      title: 'Explore Analytics',
      content: 'View detailed analytics including cost breakdowns, model usage, geographic distribution, and performance metrics to optimize your API usage.',
    },
    {
      id: 'complete',
      title: 'You\'re All Set! 🎉',
      content: 'You now know the basics of Conduit. Explore templates for standardized keys, webhooks for automation, and advanced features as you grow.',
    },
  ],
  onComplete: () => {
    localStorage.setItem('tour-completed-onboarding', 'true');
  },
};

export const apiKeysTour: Tour = {
  id: 'api-keys',
  name: 'API Keys Management',
  steps: [
    {
      id: 'overview',
      title: 'API Keys',
      content: 'Manage all your API keys here. Create individual keys, use templates, or bulk create multiple keys at once.',
    },
    {
      id: 'create',
      title: 'Creating Keys',
      content: 'Click "Create New Key" to start. You can apply a template for quick setup or configure everything manually.',
    },
    {
      id: 'quotas',
      title: 'Setting Quotas',
      content: 'Configure rate limits (requests/minute, requests/day), token quotas, and monthly spend limits to control usage and costs.',
    },
    {
      id: 'security',
      title: 'Security Settings',
      content: 'Add IP whitelists/blacklists, set expiration dates, restrict models and endpoints, and enable 2FA for enhanced security.',
    },
    {
      id: 'monitoring',
      title: 'Real-Time Monitoring',
      content: 'Click the chart icon to view real-time quota usage with color-coded progress bars and warnings when approaching limits.',
    },
    {
      id: 'bulk-ops',
      title: 'Bulk Operations',
      content: 'Use checkboxes to select multiple keys for bulk revocation. Use "Bulk Create" to generate many keys from a template.',
    },
  ],
  onComplete: () => {
    localStorage.setItem('tour-completed-api-keys', 'true');
  },
};

export const templatesTour: Tour = {
  id: 'templates',
  name: 'Key Templates',
  steps: [
    {
      id: 'intro',
      title: 'Key Templates',
      content: 'Templates let you standardize API key creation with pre-configured settings, making it 10x faster to manage many keys.',
    },
    {
      id: 'create-template',
      title: 'Create a Template',
      content: 'Define default quotas, security settings, notification channels, and more. Templates can be reused to create hundreds of consistent keys.',
    },
    {
      id: 'usage',
      title: 'Using Templates',
      content: 'When creating keys, select a template to instantly apply all its settings. Perfect for onboarding new clients or projects.',
    },
    {
      id: 'tracking',
      title: 'Usage Tracking',
      content: 'See how many keys have been created from each template. This helps identify popular configurations.',
    },
  ],
  onComplete: () => {
    localStorage.setItem('tour-completed-templates', 'true');
  },
};

export const analyticsTour: Tour = {
  id: 'analytics',
  name: 'Analytics & Monitoring',
  steps: [
    {
      id: 'overview',
      title: 'Analytics Dashboard',
      content: 'Get insights into usage patterns, costs, performance, and geographic distribution of your API traffic.',
    },
    {
      id: 'costs',
      title: 'Cost Tracking',
      content: 'Monitor spending across models and providers. Set budgets and get forecasts to prevent unexpected costs.',
    },
    {
      id: 'performance',
      title: 'Performance Metrics',
      content: 'Track latency percentiles (p50, p95, p99), error rates, and uptime to ensure your API gateway meets SLA requirements.',
    },
    {
      id: 'geo',
      title: 'Geographic Analytics',
      content: 'See where your requests come from. Useful for optimizing latency with regional providers and compliance.',
    },
  ],
  onComplete: () => {
    localStorage.setItem('tour-completed-analytics', 'true');
  },
};

export const allTours = {
  onboarding: onboardingTour,
  apiKeys: apiKeysTour,
  templates: templatesTour,
  analytics: analyticsTour,
};
