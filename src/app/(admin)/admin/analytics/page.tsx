'use client';

import { useState, useEffect } from 'react';
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
} from '@/components/ui';
import {
  Activity,
  Zap,
  DollarSign,
  Key,
  TrendingUp,
  RefreshCw,
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
  }>;
  dailyUsage: Array<{
    date: string;
    requests: number;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  }>;
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
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
  };

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
            <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

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
