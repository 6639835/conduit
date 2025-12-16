'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCost } from '@/lib/analytics/cost-calculator';

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
  modelBreakdown: Record<string, {
    requests: number;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  }>;
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
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState(30); // days

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/analytics?days=${timeRange}`);
      const data = await response.json();

      if (data.success && data.analytics) {
        setAnalytics(data.analytics);
      } else {
        setError(data.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const calculateSuccessRate = () => {
    if (!analytics) return 0;
    const { totalRequests, successfulRequests } = analytics.overview;
    if (totalRequests === 0) return 0;
    return ((successfulRequests / totalRequests) * 100).toFixed(1);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold">Global Analytics</h1>
            <p className="text-muted-foreground">
              Usage statistics across all API keys
            </p>
          </div>

          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-4 py-2 border border-border rounded-lg bg-background"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Analytics Content */}
        {!loading && analytics && (
          <div className="space-y-8">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 border border-border rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-3xl font-bold">{analytics.overview.totalRequests.toLocaleString()}</p>
                <p className="text-xs text-success">
                  {calculateSuccessRate()}% success rate
                </p>
              </div>

              <div className="p-6 border border-border rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Total Tokens</p>
                <p className="text-3xl font-bold">
                  {(analytics.overview.totalTokensInput + analytics.overview.totalTokensOutput).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analytics.overview.totalTokensInput.toLocaleString()} in • {analytics.overview.totalTokensOutput.toLocaleString()} out
                </p>
              </div>

              <div className="p-6 border border-border rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-3xl font-bold">
                  {formatCost(analytics.overview.totalCostUsd)}
                </p>
              </div>

              <div className="p-6 border border-border rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">API Keys</p>
                <p className="text-3xl font-bold">{analytics.overview.activeApiKeys}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics.overview.totalApiKeys} total
                </p>
              </div>
            </div>

            {/* Daily Usage Chart */}
            {analytics.dailyUsage.length > 0 && (
              <div className="p-6 border border-border rounded-lg space-y-4">
                <h2 className="text-xl font-semibold">Daily Usage Trend</h2>
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4">Date</th>
                          <th className="text-right py-3 px-4">Requests</th>
                          <th className="text-right py-3 px-4">Input Tokens</th>
                          <th className="text-right py-3 px-4">Output Tokens</th>
                          <th className="text-right py-3 px-4">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.dailyUsage.slice(-14).reverse().map((day) => (
                          <tr key={day.date} className="border-b border-border hover:bg-muted/50">
                            <td className="py-3 px-4">
                              {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="text-right py-3 px-4">{day.requests.toLocaleString()}</td>
                            <td className="text-right py-3 px-4">{day.tokensInput.toLocaleString()}</td>
                            <td className="text-right py-3 px-4">{day.tokensOutput.toLocaleString()}</td>
                            <td className="text-right py-3 px-4">{formatCost(day.costUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {analytics.dailyUsage.length > 14 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing last 14 days
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Two Column Layout for Model Breakdown and Top Keys */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Model Breakdown */}
              {Object.keys(analytics.modelBreakdown).length > 0 && (
                <div className="p-6 border border-border rounded-lg space-y-4">
                  <h2 className="text-xl font-semibold">Model Breakdown</h2>
                  <div className="space-y-3">
                    {Object.entries(analytics.modelBreakdown)
                      .sort((a, b) => b[1].requests - a[1].requests)
                      .map(([model, stats]) => (
                        <div key={model} className="space-y-2 pb-3 border-b border-border last:border-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{model}</p>
                            <p className="text-sm font-semibold">{formatCost(stats.costUsd)}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                            <div>
                              <p className="font-medium text-foreground">{stats.requests.toLocaleString()}</p>
                              <p>requests</p>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{stats.tokensInput.toLocaleString()}</p>
                              <p>input tokens</p>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{stats.tokensOutput.toLocaleString()}</p>
                              <p>output tokens</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Top API Keys */}
              {analytics.topApiKeys.length > 0 && (
                <div className="p-6 border border-border rounded-lg space-y-4">
                  <h2 className="text-xl font-semibold">Top API Keys</h2>
                  <div className="space-y-3">
                    {analytics.topApiKeys.map((key, index) => (
                      <div key={key.keyPrefix} className="space-y-2 pb-3 border-b border-border last:border-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{index + 1}</span>
                            <code className="font-mono text-sm">{key.keyPrefix}...</code>
                            {key.name && <span className="text-sm text-muted-foreground">({key.name})</span>}
                          </div>
                          <p className="text-sm font-semibold">{formatCost(key.costUsd)}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">{key.requests.toLocaleString()}</p>
                            <p>requests</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{key.tokensInput.toLocaleString()}</p>
                            <p>input tokens</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{key.tokensOutput.toLocaleString()}</p>
                            <p>output tokens</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Empty State */}
            {analytics.overview.totalRequests === 0 && (
              <div className="text-center py-12 border border-border rounded-lg">
                <p className="text-muted-foreground">No usage data available for the selected time range</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
