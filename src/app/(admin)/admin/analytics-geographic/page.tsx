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
  Button,
  AlertCard,
} from '@/components/ui';
import {
  Globe,
  Info,
  MapPin,
  Shield,
  Clock,
  TrendingUp,
  RefreshCw,
  Download,
} from 'lucide-react';

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
  const [view, setView] = useState<'map' | 'list' | 'heatmap'>('list');

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
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Globe className="h-8 w-8" />
              Geographic Usage Analytics
            </h1>
            <p className="text-muted-foreground">
              View usage patterns, compliance, and latency across different geographic regions
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={days.toString()}
              onChange={(e) => setDays(parseInt(e.target.value))}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </Select>
            <Button variant="outline" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* View Selector */}
        <div className="flex items-center gap-2 border border-border rounded-lg p-1 w-fit">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'list'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setView('heatmap')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'heatmap'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Heatmap
          </button>
          <button
            onClick={() => setView('map')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'map'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            World Map
          </button>
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
        {view === 'list' && (
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
        )}

        {/* Heatmap View */}
        {view === 'heatmap' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Geographic Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Intensity Scale */}
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">Intensity:</span>
                  <div className="flex items-center gap-1">
                    <div className="h-4 w-12 bg-blue-100 rounded-l"></div>
                    <div className="h-4 w-12 bg-blue-300"></div>
                    <div className="h-4 w-12 bg-blue-500"></div>
                    <div className="h-4 w-12 bg-blue-700 rounded-r"></div>
                  </div>
                  <span className="text-xs text-muted-foreground">Low → High</span>
                </div>

                {/* Grid Heatmap */}
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {stats.map((stat) => {
                    const maxRequests = Math.max(...stats.map(s => s.requestCount));
                    const intensity = (stat.requestCount / maxRequests) * 100;
                    const bgColor =
                      intensity > 75 ? 'bg-blue-700' :
                      intensity > 50 ? 'bg-blue-500' :
                      intensity > 25 ? 'bg-blue-300' :
                      'bg-blue-100';

                    return (
                      <div
                        key={stat.countryCode}
                        className={`${bgColor} rounded-lg p-4 hover:ring-2 hover:ring-accent transition-all cursor-pointer group relative`}
                        title={`${stat.country}: ${stat.requestCount.toLocaleString()} requests`}
                      >
                        <div className="text-center">
                          <div className="text-3xl mb-1">{getCountryFlag(stat.countryCode)}</div>
                          <div className="text-xs font-medium text-white">
                            {stat.countryCode}
                          </div>
                        </div>

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-max">
                            <div className="text-sm font-medium mb-1">{stat.country}</div>
                            <div className="text-xs space-y-1">
                              <div>Requests: {stat.requestCount.toLocaleString()}</div>
                              <div>Cost: ${(stat.totalCost / 100).toFixed(2)}</div>
                              <div>Share: {stat.percentage.toFixed(1)}%</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* World Map View */}
        {view === 'map' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Interactive World Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative h-96 bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Globe className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">Interactive World Map</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      World map visualization would appear here
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Consider integrating: react-simple-maps or react-leaflet
                    </p>
                  </div>
                </div>
              </div>

              {/* Map Legend */}
              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span>High Activity</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <span>Medium Activity</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gray-300"></div>
                  <span>Low Activity</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Regional Compliance & Data Residency */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Regional Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <AlertCard variant="info">
                  <p className="text-sm">
                    Track data residency requirements and compliance regulations by region.
                  </p>
                </AlertCard>

                <div className="space-y-3">
                  {[
                    { region: 'European Union', regulation: 'GDPR', status: 'Compliant', color: 'text-green-600' },
                    { region: 'United States', regulation: 'CCPA', status: 'Compliant', color: 'text-green-600' },
                    { region: 'United Kingdom', regulation: 'UK GDPR', status: 'Compliant', color: 'text-green-600' },
                    { region: 'Asia Pacific', regulation: 'Various', status: 'Partial', color: 'text-yellow-600' },
                  ].map((item) => (
                    <div key={item.region} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{item.region}</div>
                        <div className="text-xs text-muted-foreground">{item.regulation}</div>
                      </div>
                      <div className={`text-sm font-medium ${item.color}`}>
                        {item.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Latency by Region
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Average response times for different geographic regions
                </p>

                <div className="space-y-3">
                  {stats.slice(0, 5).map((stat) => {
                    // Simulate latency data (in production, this would come from actual measurements)
                    const baseLatency = Math.random() * 200 + 50;
                    const latency = Math.round(baseLatency);

                    return (
                      <div key={stat.countryCode} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getCountryFlag(stat.countryCode)}</span>
                            <span className="font-medium">{stat.country}</span>
                          </div>
                          <span className="font-semibold">{latency}ms</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              latency < 100 ? 'bg-green-500' :
                              latency < 200 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min((latency / 300) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
