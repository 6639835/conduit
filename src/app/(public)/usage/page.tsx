'use client';

import { useState } from 'react';
import { formatCost } from '@/lib/analytics/cost-calculator';
import type { UsageResponse } from '@/types';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  MetricCard,
  UsageCard,
  AlertCard,
  SkeletonMetricCard,
  DonutChart,
} from '@/components/ui';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Zap,
  Search,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export default function UsagePage() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [usageData, setUsageData] = useState<UsageResponse | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/usage?key=${encodeURIComponent(apiKey)}`);
      const data: UsageResponse = await response.json();

      if (!data.success) {
        toast.error('Failed to fetch usage data', {
          description: data.error || 'An unexpected error occurred',
        });
        setUsageData(null);
      } else {
        setUsageData(data);
        // Don't show success toast for routine data fetches - it's annoying
      }
    } catch {
      toast.error('Failed to fetch usage data', {
        description: 'An unexpected error occurred',
      });
      setUsageData(null);
    } finally {
      setLoading(false);
    }
  };

  // Transform model breakdown data for chart
  const modelChartData = usageData?.usage?.modelBreakdown
    ? Object.entries(usageData.usage.modelBreakdown).map(([name, stats]) => ({
        name: name.replace('claude-', '').replace('-', ' '),
        value: stats.requests,
      }))
    : [];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Usage Dashboard</h1>
          <p className="text-muted-foreground">
            Enter your API key to view usage statistics and remaining quota
          </p>
        </div>

        {/* Key Search Form */}
        <Card className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-cond_your-api-key-here"
                  label="API Key"
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" isLoading={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  View Usage
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonMetricCard key={i} />
            ))}
          </div>
        )}

        {/* Usage Stats */}
        {usageData?.usage && !loading && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Requests"
                value={usageData.usage.totalRequests.toLocaleString()}
                description={`${usageData.usage.successfulRequests} successful`}
                icon={Activity}
                trend={{
                  value: Math.round(
                    (usageData.usage.successfulRequests / usageData.usage.totalRequests) * 100
                  ),
                  isPositive: true,
                }}
              />

              <MetricCard
                title="Input Tokens"
                value={usageData.usage.totalTokensInput.toLocaleString()}
                icon={ArrowUpRight}
              />

              <MetricCard
                title="Output Tokens"
                value={usageData.usage.totalTokensOutput.toLocaleString()}
                icon={ArrowDownRight}
              />

              <MetricCard
                title="Total Cost"
                value={formatCost(usageData.usage.totalCostUsd)}
                icon={DollarSign}
              />
            </div>

            {/* Quota Remaining */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {usageData.usage.quotaRemaining.requestsPerMinute !== null &&
               usageData.usage.quotaLimits.requestsPerMinute !== null && (
                <UsageCard
                  title="Requests per Minute"
                  used={
                    usageData.usage.quotaLimits.requestsPerMinute -
                    (usageData.usage.quotaRemaining.requestsPerMinute || 0)
                  }
                  total={usageData.usage.quotaLimits.requestsPerMinute}
                  unit="req/min"
                />
              )}

              {usageData.usage.quotaRemaining.requestsPerDay !== null &&
               usageData.usage.quotaLimits.requestsPerDay !== null && (
                <UsageCard
                  title="Requests per Day"
                  used={
                    usageData.usage.quotaLimits.requestsPerDay -
                    (usageData.usage.quotaRemaining.requestsPerDay || 0)
                  }
                  total={usageData.usage.quotaLimits.requestsPerDay}
                  unit="req/day"
                />
              )}

              {usageData.usage.quotaRemaining.tokensPerDay !== null &&
               usageData.usage.quotaLimits.tokensPerDay !== null && (
                <UsageCard
                  title="Tokens per Day"
                  used={
                    usageData.usage.quotaLimits.tokensPerDay -
                    (usageData.usage.quotaRemaining.tokensPerDay || 0)
                  }
                  total={usageData.usage.quotaLimits.tokensPerDay}
                  unit="tokens"
                />
              )}
            </div>

            {/* Model Breakdown - Two column layout */}
            {Object.keys(usageData.usage.modelBreakdown).length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart */}
                <DonutChart
                  data={modelChartData}
                  title="Requests by Model"
                  description="Distribution of API requests across Claude models"
                  height={280}
                />

                {/* Detailed Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Model Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(usageData.usage.modelBreakdown).map(
                      ([model, stats]) => (
                        <div
                          key={model}
                          className="flex items-center justify-between py-3 border-b border-border last:border-0"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-accent" />
                              <p className="font-medium">{model}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {stats.requests} requests •{' '}
                              {(stats.tokensInput + stats.tokensOutput).toLocaleString()}{' '}
                              tokens
                            </p>
                          </div>
                          <p className="text-lg font-semibold">
                            {formatCost(stats.costUsd)}
                          </p>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Alert if over quota */}
            {(usageData.usage.quotaRemaining.requestsPerMinute === 0 ||
              usageData.usage.quotaRemaining.requestsPerDay === 0 ||
              usageData.usage.quotaRemaining.tokensPerDay === 0) && (
              <AlertCard
                title="Quota Limit Reached"
                description="You have reached one or more of your usage limits. Please wait for the limit to reset or contact your administrator."
                variant="warning"
              />
            )}
          </div>
        )}

        {/* Empty State */}
        {!usageData && !loading && (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Usage Data</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Enter your API key above to view your usage statistics,
                  remaining quota, and cost breakdown.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
