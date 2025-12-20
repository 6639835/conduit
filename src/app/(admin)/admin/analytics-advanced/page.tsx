'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  SkeletonTable,
} from '@/components/ui';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  DollarSign,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface CostProjection {
  currentDailyCost: number;
  projectedMonthlyCost: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
}

interface ErrorAnalysis {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  errorsByType: Record<string, number>;
  topErrors: Array<{
    statusCode: number;
    count: number;
    percentage: number;
  }>;
}

interface LatencyStats {
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  slowestEndpoints: Array<{
    endpoint: string;
    averageMs: number;
    count: number;
  }>;
}

export default function AdvancedAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(7);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');

  const [costData, setCostData] = useState<CostProjection | null>(null);
  const [errorData, setErrorData] = useState<ErrorAnalysis | null>(null);
  const [latencyData, setLatencyData] = useState<LatencyStats | null>(null);

  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; keyPrefix: string }>>([]);

  const fetchApiKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/keys');
      const data = await response.json();
      if (data.success && data.apiKeys) {
        setApiKeys(data.apiKeys.map((key: { id: string; name?: string; keyPrefix: string }) => ({
          id: key.id,
          name: key.name || key.keyPrefix,
          keyPrefix: key.keyPrefix,
        })));
      }
    } catch {
      toast.error('Failed to fetch API keys');
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: selectedDays.toString(),
        ...(selectedApiKey && { apiKeyId: selectedApiKey }),
      });

      // Fetch all analytics in parallel
      const [costRes, errorRes, latencyRes] = await Promise.all([
        fetch(`/api/admin/analytics/projections?${params}`),
        fetch(`/api/admin/analytics/errors?${params}`),
        fetch(`/api/admin/analytics/latency?${params}`),
      ]);

      const [costData, errorData, latencyData] = await Promise.all([
        costRes.json(),
        errorRes.json(),
        latencyRes.json(),
      ]);

      setCostData(costData.projections);
      setErrorData(errorData.analysis);
      setLatencyData(latencyData.statistics);
    } catch {
      toast.error('Failed to fetch analytics', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDays, selectedApiKey]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  useEffect(() => {
    if (apiKeys.length > 0) {
      fetchAnalytics();
    }
  }, [apiKeys, fetchAnalytics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'increasing') return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (trend === 'decreasing') return <TrendingUp className="h-4 w-4 text-success rotate-180" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Advanced Analytics</h1>
            <p className="text-muted-foreground">
              Cost projections, error analysis, and latency insights
            </p>
          </div>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Time Period</label>
                <select
                  value={selectedDays}
                  onChange={(e) => setSelectedDays(parseInt(e.target.value))}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">API Key</label>
                <select
                  value={selectedApiKey}
                  onChange={(e) => setSelectedApiKey(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">All API Keys</option>
                  {apiKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name} ({key.keyPrefix})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SkeletonTable rows={3} />
            <SkeletonTable rows={3} />
            <SkeletonTable rows={3} />
          </div>
        ) : (
          <>
            {/* Cost Projections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    Cost Projections
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {costData ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Current Daily Cost</span>
                          <span className="text-2xl font-bold">
                            {formatCurrency(costData.currentDailyCost)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Projected Monthly Cost</span>
                          <span className="text-2xl font-bold">
                            {formatCurrency(costData.projectedMonthlyCost)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        {getTrendIcon(costData.trend)}
                        <div className="flex-1">
                          <p className="text-sm font-medium capitalize">{costData.trend} Trend</p>
                          <p className="text-xs text-muted-foreground">
                            {costData.trendPercentage > 0 ? '+' : ''}
                            {costData.trendPercentage.toFixed(1)}% compared to previous period
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No cost data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-accent" />
                    Latency Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {latencyData ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="text-xl font-bold">{latencyData.averageMs.toFixed(0)}ms</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">P50</p>
                          <p className="text-xl font-bold">{latencyData.p50Ms.toFixed(0)}ms</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">P95</p>
                          <p className="text-xl font-bold">{latencyData.p95Ms.toFixed(0)}ms</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">P99</p>
                          <p className="text-xl font-bold">{latencyData.p99Ms.toFixed(0)}ms</p>
                        </div>
                      </div>

                      {latencyData.slowestEndpoints.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Slowest Endpoints</p>
                          {latencyData.slowestEndpoints.slice(0, 3).map((endpoint, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                              <code className="text-xs">{endpoint.endpoint}</code>
                              <span className="font-mono">{endpoint.averageMs.toFixed(0)}ms</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No latency data available</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Error Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Error Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {errorData ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Total Requests</p>
                        <p className="text-3xl font-bold">{errorData.totalRequests.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Total Errors</p>
                        <p className="text-3xl font-bold text-destructive">
                          {errorData.totalErrors.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Error Rate</p>
                        <p className="text-3xl font-bold">
                          {(errorData.errorRate * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {errorData.topErrors.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Top Error Types</p>
                        <div className="space-y-2">
                          {errorData.topErrors.map((error, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-destructive">
                                  {error.statusCode}
                                </span>
                                <div>
                                  <p className="text-sm font-medium">{error.count} errors</p>
                                  <p className="text-xs text-muted-foreground">
                                    {error.percentage.toFixed(1)}% of total errors
                                  </p>
                                </div>
                              </div>
                              <div className="w-32 bg-background rounded-full h-2">
                                <div
                                  className="bg-destructive h-2 rounded-full"
                                  style={{ width: `${error.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No error data available</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
