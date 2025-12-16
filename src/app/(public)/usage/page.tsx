'use client';

import { useState } from 'react';
import { formatCost } from '@/lib/analytics/cost-calculator';
import type { UsageResponse } from '@/types';

export default function UsagePage() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usageData, setUsageData] = useState<UsageResponse | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/usage?key=${encodeURIComponent(apiKey)}`);
      const data: UsageResponse = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch usage data');
        setUsageData(null);
      } else {
        setUsageData(data);
      }
    } catch (err) {
      setError('Failed to fetch usage data');
      setUsageData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Usage Dashboard</h1>
          <p className="text-muted-foreground">
            Enter your API key to view usage statistics and remaining quota
          </p>
        </div>

        {/* Key Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-cond_your-api-key-here"
              className="flex-1 px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'View Usage'}
            </button>
          </div>
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
        </form>

        {/* Usage Stats */}
        {usageData?.usage && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 border border-border rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-3xl font-bold">{usageData.usage.totalRequests.toLocaleString()}</p>
                <p className="text-xs text-success">
                  {usageData.usage.successfulRequests} successful
                </p>
              </div>

              <div className="p-6 border border-border rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Input Tokens</p>
                <p className="text-3xl font-bold">{usageData.usage.totalTokensInput.toLocaleString()}</p>
              </div>

              <div className="p-6 border border-border rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Output Tokens</p>
                <p className="text-3xl font-bold">{usageData.usage.totalTokensOutput.toLocaleString()}</p>
              </div>

              <div className="p-6 border border-border rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-3xl font-bold">
                  {formatCost(usageData.usage.totalCostUsd)}
                </p>
              </div>
            </div>

            {/* Quota Remaining */}
            <div className="p-6 border border-border rounded-lg space-y-4">
              <h2 className="text-xl font-semibold">Remaining Quota</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {usageData.usage.quotaRemaining.requestsPerMinute !== null && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Requests/Minute</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold">
                        {usageData.usage.quotaRemaining.requestsPerMinute}
                      </p>
                      <p className="text-sm text-muted-foreground">remaining</p>
                    </div>
                  </div>
                )}

                {usageData.usage.quotaRemaining.requestsPerDay !== null && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Requests/Day</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold">
                        {usageData.usage.quotaRemaining.requestsPerDay}
                      </p>
                      <p className="text-sm text-muted-foreground">remaining</p>
                    </div>
                  </div>
                )}

                {usageData.usage.quotaRemaining.tokensPerDay !== null && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Tokens/Day</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold">
                        {usageData.usage.quotaRemaining.tokensPerDay.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">remaining</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Model Breakdown */}
            {Object.keys(usageData.usage.modelBreakdown).length > 0 && (
              <div className="p-6 border border-border rounded-lg space-y-4">
                <h2 className="text-xl font-semibold">Model Breakdown</h2>
                <div className="space-y-3">
                  {Object.entries(usageData.usage.modelBreakdown).map(([model, stats]) => (
                    <div key={model} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <div className="space-y-1">
                        <p className="font-medium">{model}</p>
                        <p className="text-sm text-muted-foreground">
                          {stats.requests} requests • {(stats.tokensInput + stats.tokensOutput).toLocaleString()} tokens
                        </p>
                      </div>
                      <p className="text-lg font-semibold">{formatCost(stats.costUsd)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
