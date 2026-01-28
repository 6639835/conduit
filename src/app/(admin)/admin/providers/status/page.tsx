'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import {
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Power,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface CircuitBreakerProvider {
  providerId: string;
  providerName: string;
  providerType: string;
  providerEndpoint: string;
  providerIsActive: boolean;
  providerStatus: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  metrics: {
    successRate: number;
    failureRate: number;
    availability: number;
    healthScore: number;
  };
}

interface CircuitBreakerData {
  providers: CircuitBreakerProvider[];
  summary: {
    totalProviders: number;
    closed: number;
    open: number;
    halfOpen: number;
    averageHealthScore: number;
    totalRequests: number;
    totalFailures: number;
  };
}

export default function ProviderStatusPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CircuitBreakerData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/providers/circuit-breaker');
      if (res.ok) {
        const response = await res.json();
        setData(response.data);
      } else {
        const error = await res.json();
        toast.error('Failed to fetch circuit breaker status', {
          description: error.error,
        });
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (providerId: string, action: 'reset' | 'open') => {
    try {
      const res = await fetch('/api/admin/providers/circuit-breaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, action }),
      });

      if (res.ok) {
        toast.success(`Circuit breaker ${action === 'reset' ? 'reset' : 'opened'}`);
        fetchStatus();
      } else {
        const error = await res.json();
        toast.error('Action failed', {
          description: error.error,
        });
      }
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Action failed');
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'CLOSED':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'OPEN':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'HALF_OPEN':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'CLOSED':
        return <CheckCircle className="h-5 w-5" />;
      case 'OPEN':
        return <XCircle className="h-5 w-5" />;
      case 'HALF_OPEN':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto p-8 text-center">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-8 w-8" />
              Provider Circuit Breaker Status
            </h1>
            <p className="text-muted-foreground">
              Real-time monitoring of provider health and failover status
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto-refresh (10s)</span>
            </label>
            <Button onClick={fetchStatus} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Healthy Providers</p>
                      <p className="text-3xl font-bold text-green-600">{data.summary.closed}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Offline Providers</p>
                      <p className="text-3xl font-bold text-red-600">{data.summary.open}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                      <XCircle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Recovering</p>
                      <p className="text-3xl font-bold text-yellow-600">
                        {data.summary.halfOpen}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Health Score</p>
                      <p
                        className={`text-3xl font-bold ${getHealthColor(data.summary.averageHealthScore)}`}
                      >
                        {data.summary.averageHealthScore.toFixed(0)}%
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Global Stats */}
            <Card>
              <CardHeader>
                <CardTitle>System-Wide Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-3xl font-bold">{data.summary.totalRequests.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground mt-1">Total Requests</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-600">
                      {data.summary.totalFailures.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Total Failures</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-600">
                      {(
                        ((data.summary.totalRequests - data.summary.totalFailures) /
                          (data.summary.totalRequests || 1)) *
                        100
                      ).toFixed(2)}
                      %
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Success Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provider List */}
            <div className="space-y-4">
              {data.providers.map(provider => (
                <Card key={provider.providerId} className="overflow-hidden">
                  <div className="flex items-stretch">
                    {/* State Indicator */}
                    <div
                      className={`w-2 ${
                        provider.state === 'CLOSED'
                          ? 'bg-green-500'
                          : provider.state === 'OPEN'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                      }`}
                    />

                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{provider.providerName}</h3>
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStateColor(
                                provider.state
                              )}`}
                            >
                              {getStateIcon(provider.state)}
                              {provider.state}
                            </span>
                            {!provider.providerIsActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{provider.providerType}</span>
                            <span>•</span>
                            <span className="truncate">{provider.providerEndpoint}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(provider.providerId, 'reset')}
                            disabled={provider.state === 'CLOSED'}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reset
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(provider.providerId, 'open')}
                            disabled={provider.state === 'OPEN'}
                          >
                            <Power className="h-4 w-4 mr-1" />
                            Open
                          </Button>
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold">{provider.totalRequests}</p>
                          <p className="text-xs text-muted-foreground mt-1">Requests</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold text-green-600">
                            {provider.totalSuccesses}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Successes</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold text-red-600">
                            {provider.totalFailures}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Failures</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p
                            className={`text-2xl font-bold ${getHealthColor(
                              provider.metrics.successRate
                            )}`}
                          >
                            {provider.metrics.successRate.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Success Rate</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold">
                            {provider.metrics.availability}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Availability</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p
                            className={`text-2xl font-bold ${getHealthColor(
                              provider.metrics.healthScore
                            )}`}
                          >
                            {provider.metrics.healthScore.toFixed(0)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Health Score</p>
                        </div>
                      </div>

                      {/* State Details */}
                      <div className="flex items-center gap-6 text-sm">
                        {provider.lastSuccessTime && (
                          <div className="flex items-center gap-2 text-green-600">
                            <TrendingUp className="h-4 w-4" />
                            <span>
                              Last success:{' '}
                              {new Date(provider.lastSuccessTime).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {provider.lastFailureTime && (
                          <div className="flex items-center gap-2 text-red-600">
                            <TrendingDown className="h-4 w-4" />
                            <span>
                              Last failure:{' '}
                              {new Date(provider.lastFailureTime).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {provider.nextAttemptTime && provider.state === 'OPEN' && (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <RefreshCw className="h-4 w-4" />
                            <span>
                              Retry at: {new Date(provider.nextAttemptTime).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Info */}
            <Card>
              <CardHeader>
                <CardTitle>About Circuit Breaker</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold">CLOSED (Healthy)</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Provider is operating normally. All requests are forwarded.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <h4 className="font-semibold">OPEN (Offline)</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Provider has failed repeatedly. Requests are blocked to prevent cascading
                      failures. Automatically retries after timeout.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <h4 className="font-semibold">HALF_OPEN (Testing)</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Testing if provider has recovered. Limited requests are allowed. Closes
                      on success, reopens on failure.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
