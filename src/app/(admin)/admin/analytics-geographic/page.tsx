'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCountryFlag } from '@/lib/analytics/geo-location';

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
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Geographic Usage Analytics</h1>
        <p className="text-gray-600 mt-2">
          View usage patterns across different geographic regions
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range
            </label>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Requests</h3>
          <p className="text-3xl font-bold text-gray-900">
            {totalRequests.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Countries</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Cost</h3>
          <p className="text-3xl font-bold text-gray-900">
            ${(totalCost / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Geographic Distribution Chart (Simple Bar Chart) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Request Distribution by Region</h2>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No geographic data available for the selected period
          </div>
        ) : (
          <div className="space-y-3">
            {stats.slice(0, 10).map((stat) => (
              <div key={stat.countryCode} className="flex items-center gap-3">
                <div className="w-32 flex items-center gap-2">
                  <span className="text-2xl">{getCountryFlag(stat.countryCode)}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {stat.country}
                  </span>
                </div>

                <div className="flex-1 relative">
                  <div className="h-8 bg-gray-100 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <span className="absolute right-2 top-1 text-xs font-medium text-gray-600">
                    {stat.percentage.toFixed(1)}%
                  </span>
                </div>

                <div className="w-32 text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {stat.requestCount.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">requests</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Statistics Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Detailed Statistics</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Tokens
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.map((stat) => (
                  <tr key={stat.countryCode} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getCountryFlag(stat.countryCode)}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {stat.country}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.requestCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.percentage.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.totalTokens.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${(stat.totalCost / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg
            className="h-5 w-5 text-blue-500 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-900">
              About Geographic Analytics
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              Geographic location is determined based on the IP address of incoming requests.
              The data shown represents approximate locations and may not be 100% accurate.
              Private and localhost IPs are categorized as &quot;Local&quot;.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
