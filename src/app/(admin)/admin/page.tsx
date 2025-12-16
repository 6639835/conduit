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
  AlertCard,
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
  AlertTriangle,
} from 'lucide-react';

interface QuickStats {
  totalKeys: number;
  activeKeys: number;
  totalRequests: number;
  totalCost: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

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

    fetchStats();
  }, []);

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
    {
      href: '/admin/providers',
      title: 'Provider Settings',
      description: 'Configure Claude API providers and endpoints',
      icon: Zap,
      color: 'bg-amber-500/10 text-amber-500',
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
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Activity feed coming soon</p>
              <p className="text-sm">View detailed analytics for now</p>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <AlertCard
          title="Security Notice"
          description="Authentication is not yet implemented. In production, protect these routes with NextAuth.js or your preferred authentication solution."
          variant="warning"
        />
      </div>
    </AppLayout>
  );
}
