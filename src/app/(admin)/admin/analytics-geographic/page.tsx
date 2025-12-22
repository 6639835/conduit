'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCountryFlag } from '@/lib/analytics/geo-location';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Select,
} from '@/components/ui';
import { Globe, Info } from 'lucide-react';

interface GeoStats {
  country: string;
  countryCode: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  percentage: number;
}

export default function GeographicAnalyticsPage() {
  const [stats, setStats] = useState<GeoStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: days.toString() });

      const response = await fetch(`/api/admin/analytics/geographic?${params}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching geographic stats:', error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalRequests = stats.reduce((sum, stat) => sum + stat.requestCount, 0);
  const totalCost = stats.reduce((sum, stat) => sum + stat.totalCost, 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Geographic Usage Analytics</h1>
            <p className="text-muted-foreground">
              View usage patterns across different geographic regions
            </p>
          </div>
          <Select
            value={days.toString()}
            onChange={(e) => setDays(parseInt(e.target.value))}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Requests</h3>
            <p className="text-3xl font-bold">
              {totalRequests.toLocaleString()}
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Countries</h3>
            <p className="text-3xl font-bold">{stats.length}</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Cost</h3>
            <p className="text-3xl font-bold">
              ${(totalCost / 100).toFixed(2)}
            </p>
          </Card>
        </div>

        {/* Geographic Distribution Chart (Simple Bar Chart) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Request Distribution by Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
              </div>
            ) : stats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No geographic data available for the selected period
              </div>
            ) : (
              <div className="space-y-3">
                {stats.slice(0, 10).map((stat) => (
                  <div key={stat.countryCode} className="flex items-center gap-3">
                    <div className="w-32 flex items-center gap-2">
                      <span className="text-2xl">{getCountryFlag(stat.countryCode)}</span>
                      <span className="text-sm font-medium">
                        {stat.country}
                      </span>
                    </div>

                    <div className="flex-1 relative">
                      <div className="h-8 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </div>
                      <span className="absolute right-2 top-1 text-xs font-medium text-muted-foreground">
                        {stat.percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-32 text-right">
                      <span className="text-sm font-semibold">
                        {stat.requestCount.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">requests</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Statistics Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detailed Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Country
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Requests
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Percentage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Total Tokens
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Total Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {stats.map((stat) => (
                      <tr key={stat.countryCode} className="hover:bg-muted/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getCountryFlag(stat.countryCode)}</span>
                            <span className="text-sm font-medium">
                              {stat.country}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {stat.requestCount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {stat.percentage.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {stat.totalTokens.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          ${(stat.totalCost / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-accent mt-0.5" />
              <div>
                <h3 className="text-sm font-medium">
                  About Geographic Analytics
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Geographic location is determined based on the IP address of incoming requests.
                  The data shown represents approximate locations and may not be 100% accurate.
                  Private and localhost IPs are categorized as &quot;Local&quot;.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
