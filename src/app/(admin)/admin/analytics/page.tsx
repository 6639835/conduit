'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCost } from '@/lib/analytics/cost-calculator';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  MetricCard,
  DataTable,
  type Column,
  SkeletonMetricCard,
  SkeletonChart,
  UsageChart,
  DonutChart,
  StackedBarChart,
  Input,
  AlertCard,
} from '@/components/ui';
import {
  Activity,
  Zap,
  DollarSign,
  Key,
  TrendingUp,
  RefreshCw,
  Download,
  AlertTriangle,
  Info,
  Flame,
  Target,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface AnalyticsData {
  overview: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    totalCostUsd: number;
    totalApiKeys: number;
    activeApiKeys: number;
  };
  modelBreakdown: Record<
    string,
    {
      requests: number;
      tokensInput: number;
      tokensOutput: number;
      costUsd: number;
    }
  >;
  topApiKeys: Array<{
    keyPrefix: string;
    name: string | null;
    requests: number;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    id: string;
  }>;
  dailyUsage: Array<{
    date: string;
    requests: number;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  }>;
}

interface BudgetAnalytics {
  projection: {
    currentSpend: number;
    projectedMonthlySpend: number;
    projectedDailyAverage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    percentageChange: number;
    estimatedEndOfMonthSpend: number;
  };
  burnRate: {
    daily: number;
    weekly: number;
    monthly: number;
    percentageChange: number;
    daysUntilBudgetExhausted: number | null;
  };
  costBreakdown: {
    byModel: Record<string, number>;
    total: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
  }>;
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [budgetAnalytics, setBudgetAnalytics] = useState<BudgetAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [timeRange, setTimeRange] = useState(30);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [monthlyBudget, setMonthlyBudget] = useState<string>('');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?days=${timeRange}`);
      const data = await response.json();

      if (data.success && data.analytics) {
        setAnalytics(data.analytics);
      } else {
        toast.error('Failed to fetch analytics', {
          description: data.error || 'Failed to fetch analytics',
        });
      }
    } catch {
      toast.error('Failed to fetch analytics data', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const fetchBudgetAnalytics = useCallback(async () => {
    if (!selectedApiKey && !monthlyBudget) {
      setBudgetAnalytics(null);
      return;
    }

    setBudgetLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedApiKey) params.append('apiKeyId', selectedApiKey);
      if (monthlyBudget) params.append('monthlyBudget', monthlyBudget);

      const response = await fetch(`/api/admin/analytics/budgets?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.data) {
        setBudgetAnalytics(data.data);
      } else {
        toast.error('Failed to fetch budget analytics', {
          description: data.error || 'Failed to fetch budget analytics',
        });
      }
    } catch {
      toast.error('Failed to fetch budget data', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setBudgetLoading(false);
    }
  }, [selectedApiKey, monthlyBudget]);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const response = await fetch(`/api/admin/analytics/export?format=${format}&days=${timeRange}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      if (format === 'json') {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usage-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usage-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast.success(`Exported as ${format.toUpperCase()}`, {
        description: 'Download started',
      });
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchBudgetAnalytics();
  }, [fetchBudgetAnalytics]);

  const calculateSuccessRate = () => {
    if (!analytics) return 0;
    const { totalRequests, successfulRequests } = analytics.overview;
    if (totalRequests === 0) return 0;
    return Math.round((successfulRequests / totalRequests) * 100);
  };

  // Transform data for charts
  const dailyChartData =
    analytics?.dailyUsage.map((day) => ({
      date: new Date(day.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      value: day.requests,
      tokens: day.tokensInput + day.tokensOutput,
      cost: day.costUsd,
    })) || [];

  const modelPieData = analytics
    ? Object.entries(analytics.modelBreakdown).map(([name, stats]) => ({
        name: name.replace('claude-', '').replace('-', ' '),
        value: stats.requests,
      }))
    : [];

  const tokenBarData = analytics
    ? Object.entries(analytics.modelBreakdown).map(([name, stats]) => ({
        name: name.replace('claude-', '').split('-')[0],
        Input: stats.tokensInput,
        Output: stats.tokensOutput,
      }))
    : [];

  const topKeysColumns: Column<AnalyticsData['topApiKeys'][0]>[] = [
    {
      key: 'rank',
      header: '#',
      render: (_item, index) => (
        <span className="text-muted-foreground">{index + 1}</span>
      ),
    },
    {
      key: 'keyPrefix',
      header: 'API Key',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <code className="font-mono text-sm">{row.keyPrefix}...</code>
          {row.name && (
            <span className="text-sm text-muted-foreground">({row.name})</span>
          )}
        </div>
      ),
    },
    {
      key: 'requests',
      header: 'Requests',
      sortable: true,
      render: (row) => row.requests.toLocaleString(),
    },
    {
      key: 'tokens',
      header: 'Tokens',
      render: (row) => (row.tokensInput + row.tokensOutput).toLocaleString(),
    },
    {
      key: 'costUsd',
      header: 'Cost',
      sortable: true,
      render: (row) => formatCost(row.costUsd),
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Global Analytics</h1>
            <p className="text-muted-foreground">
              Usage statistics across all API keys
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={timeRange.toString()}
              onChange={(e) => setTimeRange(parseInt(e.target.value))}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('json')}>
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Budget Analytics Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Budget Analytics & Forecasting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Filter by API Key (Optional)
                </label>
                <Select
                  value={selectedApiKey}
                  onChange={(e) => setSelectedApiKey(e.target.value)}
                >
                  <option value="">All API Keys</option>
                  {analytics?.topApiKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name || key.keyPrefix}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Monthly Budget ($)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="e.g. 1000"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={fetchBudgetAnalytics}
                  disabled={budgetLoading || (!selectedApiKey && !monthlyBudget)}
                  className="w-full"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analyze Budget
                </Button>
              </div>
            </div>

            {/* Budget Alerts */}
            {budgetAnalytics && budgetAnalytics.alerts.length > 0 && (
              <div className="space-y-2 mt-4">
                {budgetAnalytics.alerts.map((alert, idx) => (
                  <AlertCard
                    key={idx}
                    variant={alert.type === 'error' ? 'destructive' : alert.type === 'warning' ? 'warning' : 'info'}
                  >
                    <div className="flex items-start gap-3">
                      {alert.type === 'error' && <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />}
                      {alert.type === 'warning' && <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />}
                      {alert.type === 'info' && <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />}
                      <p className="text-sm flex-1">{alert.message}</p>
                    </div>
                  </AlertCard>
                ))}
              </div>
            )}

            {/* Budget Metrics */}
            {budgetAnalytics && !budgetLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <MetricCard
                  title="Current Spend"
                  value={formatCost(budgetAnalytics.projection.currentSpend)}
                  description="This month so far"
                  icon={DollarSign}
                />
                <MetricCard
                  title="Projected Monthly"
                  value={formatCost(budgetAnalytics.projection.estimatedEndOfMonthSpend)}
                  description={`${budgetAnalytics.projection.trend} trend`}
                  icon={TrendingUp}
                  trend={{
                    value: Math.abs(budgetAnalytics.projection.percentageChange),
                    isPositive: budgetAnalytics.projection.trend === 'decreasing',
                  }}
                />
                <MetricCard
                  title="Daily Burn Rate"
                  value={`$${budgetAnalytics.burnRate.daily.toFixed(2)}`}
                  description={`$${budgetAnalytics.burnRate.weekly.toFixed(2)}/week`}
                  icon={Flame}
                  trend={{
                    value: Math.abs(budgetAnalytics.burnRate.percentageChange),
                    isPositive: budgetAnalytics.burnRate.percentageChange < 0,
                  }}
                />
                <MetricCard
                  title="Budget Runway"
                  value={
                    budgetAnalytics.burnRate.daysUntilBudgetExhausted !== null
                      ? `${budgetAnalytics.burnRate.daysUntilBudgetExhausted} days`
                      : 'No limit set'
                  }
                  description={monthlyBudget ? `$${monthlyBudget}/month budget` : 'Set budget to track'}
                  icon={Target}
                />
              </div>
            )}

            {/* Cost Breakdown by Model */}
            {budgetAnalytics && Object.keys(budgetAnalytics.costBreakdown.byModel).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-3">Cost Breakdown by Model</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(budgetAnalytics.costBreakdown.byModel)
                    .sort((a, b) => b[1] - a[1])
                    .map(([model, cost]) => {
                      const percentage = (cost / budgetAnalytics.costBreakdown.total) * 100;
                      return (
                        <div key={model} className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium truncate">{model}</span>
                            <span className="text-sm font-semibold text-accent">
                              ${cost.toFixed(2)}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {budgetLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <RefreshCw className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Analyzing budget data...</p>
                </div>
              </div>
            )}

            {!budgetAnalytics && !budgetLoading && (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select an API key or set a monthly budget to view forecasting analytics
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonMetricCard key={i} />
              ))}
            </>
          ) : analytics ? (
            <>
              <MetricCard
                title="Total Requests"
                value={analytics.overview.totalRequests.toLocaleString()}
                description={`${calculateSuccessRate()}% success rate`}
                icon={Activity}
                trend={{
                  value: calculateSuccessRate(),
                  isPositive: calculateSuccessRate() > 90,
                }}
              />
              <MetricCard
                title="Total Tokens"
                value={(
                  analytics.overview.totalTokensInput +
                  analytics.overview.totalTokensOutput
                ).toLocaleString()}
                description={`${analytics.overview.totalTokensInput.toLocaleString()} in • ${analytics.overview.totalTokensOutput.toLocaleString()} out`}
                icon={Zap}
              />
              <MetricCard
                title="Total Cost"
                value={formatCost(analytics.overview.totalCostUsd)}
                icon={DollarSign}
              />
              <MetricCard
                title="Active API Keys"
                value={analytics.overview.activeApiKeys.toString()}
                description={`${analytics.overview.totalApiKeys} total keys`}
                icon={Key}
              />
            </>
          ) : null}
        </div>

        {/* Charts Row */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        ) : analytics && analytics.overview.totalRequests > 0 ? (
          <>
            {/* Usage Over Time Chart */}
            <UsageChart
              data={dailyChartData}
              title="Requests Over Time"
              description={`Daily request volume for the last ${timeRange} days`}
              dataKey="value"
              type="area"
              height={300}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Model Distribution */}
              <DonutChart
                data={modelPieData}
                title="Requests by Model"
                description="Distribution of API requests across Claude models"
                height={300}
              />

              {/* Token Usage by Model */}
              <StackedBarChart
                data={tokenBarData}
                title="Token Usage by Model"
                description="Input vs output tokens per model"
                categories={['Input', 'Output']}
                height={300}
              />
            </div>

            {/* Top API Keys */}
            {analytics.topApiKeys.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Top API Keys by Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable
                    data={analytics.topApiKeys}
                    columns={topKeysColumns}
                    pageSize={5}
                    emptyMessage="No API key usage data available"
                  />
                </CardContent>
              </Card>
            )}

            {/* Model Breakdown Details */}
            {Object.keys(analytics.modelBreakdown).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Model Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(analytics.modelBreakdown)
                      .sort((a, b) => b[1].requests - a[1].requests)
                      .map(([model, stats]) => (
                        <Card key={model} variant="outlined" className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm truncate">
                                {model}
                              </h4>
                              <span className="text-sm font-semibold text-accent">
                                {formatCost(stats.costUsd)}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <p className="font-semibold">
                                  {stats.requests.toLocaleString()}
                                </p>
                                <p className="text-muted-foreground">requests</p>
                              </div>
                              <div>
                                <p className="font-semibold">
                                  {stats.tokensInput.toLocaleString()}
                                </p>
                                <p className="text-muted-foreground">input</p>
                              </div>
                              <div>
                                <p className="font-semibold">
                                  {stats.tokensOutput.toLocaleString()}
                                </p>
                                <p className="text-muted-foreground">output</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          !loading && (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-full bg-muted p-4">
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">No Data Available</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    No usage data available for the selected time range. Start
                    making API requests to see analytics.
                  </p>
                </div>
              </div>
            </Card>
          )
        )}
      </div>
    </AppLayout>
  );
}
