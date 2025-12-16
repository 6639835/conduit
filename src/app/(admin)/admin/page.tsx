'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  MetricCard,
  SkeletonMetricCard,
} from '@/components/ui';
import {
  Key,
  BarChart3,
  Users,
  Zap,
  Activity,
  DollarSign,
  ArrowRight,
} from 'lucide-react';

interface QuickStats {
  totalKeys: number;
  activeKeys: number;
  totalRequests: number;
  totalCost: number;
}

interface ActivityItem {
  id: string;
  type: 'api_request' | 'key_created' | 'key_revoked' | 'user_added' | 'provider_added';
  description: string;
  timestamp: string;
  metadata?: {
    keyPrefix?: string;
    email?: string;
    provider?: string;
    model?: string;
    status?: 'success' | 'error';
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/analytics?days=30');
        const data = await response.json();

        if (data.success && data.analytics) {
          setStats({
            totalKeys: data.analytics.overview.totalApiKeys,
            activeKeys: data.analytics.overview.activeApiKeys,
            totalRequests: data.analytics.overview.totalRequests,
            totalCost: data.analytics.overview.totalCostUsd,
          });
        }
      } catch {
        // Silently fail, will show empty state
      } finally {
        setLoading(false);
      }
    };

    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/admin/activity?limit=50&days=7');
        const data = await response.json();

        if (data.success && data.activities) {
          setActivities(data.activities);
        }
      } catch {
        // Silently fail, will show empty state
      } finally {
        setActivitiesLoading(false);
      }
    };

    fetchStats();
    fetchActivities();
  }, []);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'api_request':
        return Activity;
      case 'key_created':
      case 'key_revoked':
        return Key;
      case 'user_added':
        return Users;
      case 'provider_added':
        return Zap;
      default:
        return Activity;
    }
  };

  const getActivityColor = (type: ActivityItem['type'], status?: 'success' | 'error') => {
    if (status === 'error') return 'text-destructive bg-destructive/10';

    switch (type) {
      case 'api_request':
        return 'text-blue-500 bg-blue-500/10';
      case 'key_created':
        return 'text-success bg-success/10';
      case 'key_revoked':
        return 'text-destructive bg-destructive/10';
      case 'user_added':
        return 'text-violet-500 bg-violet-500/10';
      case 'provider_added':
        return 'text-amber-500 bg-amber-500/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const quickLinks = [
    {
      href: '/admin/keys',
      title: 'API Key Management',
      description: 'Create, view, update, and revoke API keys',
      icon: Key,
      color: 'bg-accent/10 text-accent',
    },
    {
      href: '/admin/analytics',
      title: 'Global Analytics',
      description: 'View usage statistics across all API keys',
      icon: BarChart3,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      href: '/admin/users',
      title: 'User Management',
      description: 'Manage users and their permissions',
      icon: Users,
      color: 'bg-violet-500/10 text-violet-500',
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage API keys and monitor usage across all users
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonMetricCard key={i} />
              ))}
            </>
          ) : (
            <>
              <MetricCard
                title="Total API Keys"
                value={stats?.totalKeys.toLocaleString() || '0'}
                icon={Key}
              />
              <MetricCard
                title="Active Keys"
                value={stats?.activeKeys.toLocaleString() || '0'}
                icon={Activity}
                trend={
                  stats
                    ? {
                        value: Math.round((stats.activeKeys / stats.totalKeys) * 100) || 0,
                        isPositive: true,
                      }
                    : undefined
                }
              />
              <MetricCard
                title="Total Requests (30d)"
                value={stats?.totalRequests.toLocaleString() || '0'}
                icon={BarChart3}
              />
              <MetricCard
                title="Total Cost (30d)"
                value={`$${(stats?.totalCost || 0).toFixed(2)}`}
                icon={DollarSign}
              />
            </>
          )}
        </div>

        {/* Quick Links */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`rounded-lg p-3 ${link.color}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold group-hover:text-accent transition-colors">
                            {link.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {link.description}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-start gap-4 animate-pulse">
                    <div className="rounded-lg p-2 bg-muted w-10 h-10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
                <p className="text-sm">Activity will appear here as users interact with the gateway</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.slice(0, 8).map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  const colorClass = getActivityColor(activity.type, activity.metadata?.status);

                  return (
                    <div key={activity.id} className="flex items-start gap-4 group">
                      <div className={`rounded-lg p-2 ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {activity.metadata?.keyPrefix && (
                            <code className="font-mono">{activity.metadata.keyPrefix}</code>
                          )}
                          {activity.metadata?.email && (
                            <span>{activity.metadata.email}</span>
                          )}
                          {activity.metadata?.provider && (
                            <span>{activity.metadata.provider}</span>
                          )}
                          {activity.metadata?.model && (
                            <span className="px-1.5 py-0.5 bg-muted rounded">
                              {activity.metadata.model}
                            </span>
                          )}
                          {activity.metadata?.status === 'error' && (
                            <span className="px-1.5 py-0.5 bg-destructive/20 text-destructive rounded">
                              Failed
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  );
                })}
                {activities.length > 8 && (
                  <div className="pt-4 border-t">
                    <Link
                      href="/admin/analytics"
                      className="text-sm text-accent hover:underline flex items-center gap-1"
                    >
                      View all activity
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
