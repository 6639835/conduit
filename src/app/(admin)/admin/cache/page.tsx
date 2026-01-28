'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Database, TrendingUp, Zap, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  name: string | null;
  keyPrefix: string;
}

interface CacheAnalytics {
  totalEntries: number;
  avgHitCount: number;
  topQueries: Array<{
    prompt: string;
    hitCount: number;
    lastAccessed: Date;
  }>;
  hitRate: number;
  memoryUsage: number;
}

export default function CachePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [analytics, setAnalytics] = useState<CacheAnalytics | null>(null);

  const loadApiKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/keys?limit=100');
      if (!res.ok) throw new Error('Failed to load API keys');

      const data = await res.json();
      setApiKeys(data.data || []);

      if (data.data?.length > 0 && !selectedKeyId) {
        setSelectedKeyId(data.data[0].id);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load API keys',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedKeyId, toast]);

  const loadCacheAnalytics = useCallback(async () => {
    if (!selectedKeyId) return;

    try {
      const res = await fetch(`/api/admin/cache?apiKeyId=${selectedKeyId}`);
      if (!res.ok) throw new Error('Failed to load analytics');

      const data = await res.json();
      setAnalytics(data.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setAnalytics(null);
    }
  }, [selectedKeyId]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  useEffect(() => {
    if (selectedKeyId) {
      loadCacheAnalytics();
    }
  }, [selectedKeyId, loadCacheAnalytics]);

  async function clearCache() {
    if (!selectedKeyId || !confirm('Are you sure you want to clear the cache? This cannot be undone.')) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch(`/api/admin/cache?apiKeyId=${selectedKeyId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to clear cache');

      const data = await res.json();

      toast({
        title: 'Success',
        description: `Cleared ${data.data.entriesCleared} cache entries`,
      });

      // Reload analytics
      await loadCacheAnalytics();
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to clear cache',
      });
    } finally {
      setClearing(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Advanced Caching</h1>
        <p className="text-muted-foreground mt-2">
          Semantic cache analytics and management
        </p>
      </div>

      {/* API Key Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select API Key</CardTitle>
          <CardDescription>
            View cache analytics for a specific API key
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select an API key" />
            </SelectTrigger>
            <SelectContent>
              {apiKeys.map(key => (
                <SelectItem key={key.id} value={key.id}>
                  {key.name || key.keyPrefix} ({key.keyPrefix})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={loadCacheAnalytics}
            disabled={!selectedKeyId}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="destructive"
            onClick={clearCache}
            disabled={!selectedKeyId || clearing}
          >
            {clearing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Cache
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {selectedKeyId && analytics && (
        <>
          {/* Cache Statistics */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalEntries}</div>
                <p className="text-xs text-muted-foreground">Cached responses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Hit Count</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.avgHitCount.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Average cache hits</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(analytics.hitRate * 100).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Cache effectiveness</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBytes(analytics.memoryUsage)}</div>
                <p className="text-xs text-muted-foreground">Estimated size</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Cached Queries */}
          <Card>
            <CardHeader>
              <CardTitle>Top Cached Queries</CardTitle>
              <CardDescription>
                Most frequently accessed cached responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.topQueries.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topQueries.map((query, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{idx + 1}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(query.lastAccessed).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-mono">{query.prompt}</p>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-lg font-semibold">{query.hitCount}</div>
                        <p className="text-xs text-muted-foreground">hits</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>No cached queries yet</p>
                  <p className="text-sm">Cache entries will appear here as they are created</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cache Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Cache Configuration</CardTitle>
              <CardDescription>
                Semantic cache settings and behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Similarity Threshold</h4>
                    <p className="text-sm text-muted-foreground">
                      85% - Prompts must be at least 85% similar to match cached responses
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">TTL (Time to Live)</h4>
                    <p className="text-sm text-muted-foreground">
                      3600 seconds (1 hour) - Cache entries expire after 1 hour
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Max Cache Size</h4>
                    <p className="text-sm text-muted-foreground">
                      10,000 entries - Oldest entries are removed when limit is reached
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Embedding Model</h4>
                    <p className="text-sm text-muted-foreground">
                      Simple (128-dimensional) - Character and word-based embeddings
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">How Semantic Caching Works</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Prompts are converted to numerical embeddings (vectors)</li>
                    <li>Incoming queries are compared to cached entries using cosine similarity</li>
                    <li>If similarity exceeds threshold, cached response is returned</li>
                    <li>Reduces API costs and improves response times for similar queries</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Impact */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Impact</CardTitle>
              <CardDescription>
                Estimated savings from semantic caching
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Cost Savings</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${((analytics.avgHitCount * analytics.totalEntries * 0.001) || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Approximate saved</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Latency Reduction</p>
                    <p className="text-2xl font-bold text-blue-600">~95%</p>
                    <p className="text-xs text-muted-foreground">For cache hits</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">API Calls Saved</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.floor(analytics.avgHitCount * analytics.totalEntries)}
                    </p>
                    <p className="text-xs text-muted-foreground">Estimated</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedKeyId && !analytics && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading cache analytics...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
