/**
 * Plugin Marketplace
 * Discover and install community plugins
 */

import { Plugin, PluginCategory } from './types';
import { slackNotificationsPlugin } from './builtin/slack-notifications';
import { requestLoggerPlugin } from './builtin/request-logger';

/**
 * Marketplace plugins (mix of official and community)
 */
export const marketplacePlugins: Plugin[] = [
  slackNotificationsPlugin,
  requestLoggerPlugin,

  // PagerDuty Integration
  {
    id: 'pagerduty-alerts',
    name: 'PagerDuty Alerts',
    version: '1.0.0',
    description: 'Create PagerDuty incidents for critical errors and outages',
    author: {
      name: 'Community',
      url: 'https://github.com/community/pagerduty-plugin',
    },
    category: PluginCategory.NOTIFICATION,
    tags: ['pagerduty', 'alerts', 'incidents', 'on-call'],
    icon: 'https://cdn.simpleicons.org/pagerduty',
    isOfficial: false,
    isInstalled: false,
    isEnabled: false,
    hooks: {},
    repository: 'https://github.com/community/pagerduty-plugin',
    license: 'Apache-2.0',
    downloads: 620,
    rating: 4.6,
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-10-20'),
  },

  // Prometheus Metrics
  {
    id: 'prometheus-metrics',
    name: 'Prometheus Metrics',
    version: '1.2.0',
    description: 'Export metrics to Prometheus for monitoring and alerting',
    author: {
      name: 'Conduit Team',
      email: 'plugins@conduit.dev',
    },
    category: PluginCategory.MONITORING,
    tags: ['prometheus', 'metrics', 'monitoring', 'grafana'],
    icon: 'https://cdn.simpleicons.org/prometheus',
    isOfficial: true,
    isInstalled: false,
    isEnabled: false,
    hooks: {},
    repository: 'https://github.com/conduit/plugins/tree/main/prometheus',
    license: 'MIT',
    downloads: 2100,
    rating: 4.9,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-12-10'),
  },

  // Custom Rate Limiting
  {
    id: 'advanced-rate-limiter',
    name: 'Advanced Rate Limiter',
    version: '2.0.0',
    description: 'Sophisticated rate limiting with burst handling and adaptive limits',
    author: {
      name: 'Community',
      url: 'https://github.com/community/rate-limiter',
    },
    category: PluginCategory.RATE_LIMITING,
    tags: ['rate-limiting', 'throttling', 'quota', 'burst'],
    icon: '🚦',
    isOfficial: false,
    isInstalled: false,
    isEnabled: false,
    hooks: {},
    repository: 'https://github.com/community/rate-limiter',
    license: 'MIT',
    downloads: 980,
    rating: 4.3,
    createdAt: new Date('2024-04-15'),
    updatedAt: new Date('2024-11-25'),
  },

  // Content Moderation
  {
    id: 'content-moderation',
    name: 'Content Moderation',
    version: '1.1.0',
    description: 'Filter and block inappropriate content using ML models',
    author: {
      name: 'Conduit Team',
      email: 'plugins@conduit.dev',
    },
    category: PluginCategory.SECURITY,
    tags: ['moderation', 'filtering', 'safety', 'compliance'],
    icon: '🛡️',
    isOfficial: true,
    isInstalled: false,
    isEnabled: false,
    hooks: {},
    repository: 'https://github.com/conduit/plugins/tree/main/moderation',
    license: 'MIT',
    downloads: 1450,
    rating: 4.7,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-11-30'),
  },

  // Webhook Notifier
  {
    id: 'webhook-notifier',
    name: 'Webhook Notifier',
    version: '1.0.0',
    description: 'Send webhook notifications for any event with custom payloads',
    author: {
      name: 'Community',
      url: 'https://github.com/community/webhook-notifier',
    },
    category: PluginCategory.NOTIFICATION,
    tags: ['webhook', 'http', 'notifications', 'integration'],
    icon: '🔔',
    isOfficial: false,
    isInstalled: false,
    isEnabled: false,
    hooks: {},
    repository: 'https://github.com/community/webhook-notifier',
    license: 'MIT',
    downloads: 780,
    rating: 4.4,
    createdAt: new Date('2024-05-20'),
    updatedAt: new Date('2024-10-15'),
  },

  // Response Transformer
  {
    id: 'response-transformer',
    name: 'Response Transformer',
    version: '1.0.0',
    description: 'Transform and format responses before returning to clients',
    author: {
      name: 'Community',
      url: 'https://github.com/community/transformer',
    },
    category: PluginCategory.TRANSFORMATION,
    tags: ['transform', 'format', 'customize', 'middleware'],
    icon: '🔄',
    isOfficial: false,
    isInstalled: false,
    isEnabled: false,
    hooks: {},
    repository: 'https://github.com/community/transformer',
    license: 'Apache-2.0',
    downloads: 560,
    rating: 4.2,
    createdAt: new Date('2024-06-10'),
    updatedAt: new Date('2024-09-05'),
  },

  // Cost Analytics
  {
    id: 'cost-analytics',
    name: 'Cost Analytics',
    version: '1.3.0',
    description: 'Detailed cost breakdown and optimization recommendations',
    author: {
      name: 'Conduit Team',
      email: 'plugins@conduit.dev',
    },
    category: PluginCategory.ANALYTICS,
    tags: ['cost', 'analytics', 'optimization', 'reporting'],
    icon: '💰',
    isOfficial: true,
    isInstalled: false,
    isEnabled: false,
    hooks: {},
    repository: 'https://github.com/conduit/plugins/tree/main/cost-analytics',
    license: 'MIT',
    downloads: 1890,
    rating: 4.8,
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-12-05'),
  },
];

/**
 * Get all marketplace plugins
 */
export function getMarketplacePlugins(filters?: {
  category?: PluginCategory;
  isOfficial?: boolean;
  search?: string;
}): Plugin[] {
  let plugins = [...marketplacePlugins];

  if (filters?.category) {
    plugins = plugins.filter(p => p.category === filters.category);
  }

  if (filters?.isOfficial !== undefined) {
    plugins = plugins.filter(p => p.isOfficial === filters.isOfficial);
  }

  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    plugins = plugins.filter(
      p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower) ||
        p.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  // Sort by downloads (popularity)
  plugins.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

  return plugins;
}

/**
 * Get a specific marketplace plugin
 */
export function getMarketplacePlugin(pluginId: string): Plugin | undefined {
  return marketplacePlugins.find(p => p.id === pluginId);
}

/**
 * Get featured plugins
 */
export function getFeaturedPlugins(): Plugin[] {
  return marketplacePlugins
    .filter(p => p.isOfficial || (p.downloads || 0) > 1000)
    .slice(0, 6);
}

/**
 * Get plugin categories with counts
 */
export function getPluginCategories(): Array<{ category: PluginCategory; count: number }> {
  const categoryCounts = new Map<PluginCategory, number>();

  for (const plugin of marketplacePlugins) {
    const count = categoryCounts.get(plugin.category) || 0;
    categoryCounts.set(plugin.category, count + 1);
  }

  return Array.from(categoryCounts.entries()).map(([category, count]) => ({
    category,
    count,
  }));
}
