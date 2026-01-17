'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  MetricCard,
  SkeletonMetricCard,
} from '@/components/ui';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Activity, Database, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { toast } from '@/lib/toast';

interface HealthCheck {
  status: 'healthy' | 'degraded';
  timestamp: string;
  responseTime: number;
  checks: Record<string, { status: string; latency?: number; error?: string }>;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  isActive: boolean;
  isDefault: boolean;
  status: string | null;
  lastTestedAt: string | null;
}

export default function AdminStatusPage() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [healthResponse, providersResponse] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/admin/providers'),
      ]);

      const healthData = await healthResponse.json();
      const providerData = await providersResponse.json();

      setHealth(healthData);
      setProviders(providerData.providers || []);
    } catch {
      toast.error('Failed to load system status', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const activeProviders = providers.filter((provider) => provider.isActive);
  const healthyProviders = providers.filter((provider) => provider.status === 'healthy');

  const statusPill = (status?: string) => {
    if (status === 'healthy') return 'bg-success/20 text-success';
    if (status === 'unhealthy') return 'bg-destructive/20 text-destructive';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Status</h1>
            <p className="text-muted-foreground">
              Monitor health checks, dependencies, and provider availability
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStatus}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <SkeletonMetricCard key={index} />
            ))
          ) : (
            <>
              <MetricCard
                title="Overall Status"
                value={health?.status === 'healthy' ? 'Healthy' : 'Degraded'}
                icon={ShieldCheck}
              />
              <MetricCard
                title="Response Time"
                value={health ? `${health.responseTime} ms` : '—'}
                icon={Activity}
              />
              <MetricCard
                title="Active Providers"
                value={activeProviders.length.toString()}
                icon={Server}
              />
              <MetricCard
                title="Healthy Providers"
                value={healthyProviders.length.toString()}
                icon={Server}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-4 w-4" />
                Dependency Checks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {health ? (
                <div className="space-y-4">
                  {Object.entries(health.checks).map(([name, check]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">{name}</p>
                        {check.error && (
                          <p className="text-xs text-destructive">{check.error}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusPill(check.status)}`}>
                          {check.status}
                        </span>
                        {check.latency !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">{check.latency} ms</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(health.timestamp).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No health data available.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-4 w-4" />
                Providers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {providers.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No providers configured yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Last Tested</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {providers.map((provider) => (
                        <TableRow key={provider.id}>
                          <TableCell>
                            <div className="text-sm font-medium">{provider.name}</div>
                            <div className="text-xs text-muted-foreground">{provider.endpoint}</div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusPill(provider.status || 'unknown')}`}>
                              {provider.status || 'unknown'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{provider.type}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {provider.lastTestedAt
                              ? new Date(provider.lastTestedAt).toLocaleString()
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
