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
import { Loader2, Play, GitCompare, Bug, Clock, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCost } from '@/lib/analytics/cost-calculator';

interface ApiKey {
  id: string;
  name: string | null;
  keyPrefix: string;
}

interface RequestLog {
  id: string;
  model: string | null;
  statusCode: number | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  cost: number;
  createdAt: string;
}

interface ReplayResult {
  id: string;
  originalRequestId: string;
  prompt: string;
  model: string;
  replayedAt: Date;
  result: {
    success: boolean;
    latencyMs: number;
    error?: string;
  };
}

interface Comparison {
  differences: {
    latency: {
      original: number;
      replayed: number;
      diff: number;
      percentChange: number;
    };
    cost: {
      original: number;
      replayed: number;
      diff: number;
      percentChange: number;
    };
    response: {
      changed: boolean;
      similarity?: number;
    };
  };
}

export default function DebugPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [recentRequests, setRecentRequests] = useState<RequestLog[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [debugModeEnabled, setDebugModeEnabled] = useState(false);

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

  const loadRecentRequests = useCallback(async () => {
    if (!selectedKeyId) return;

    try {
      const res = await fetch(`/api/admin/logs?apiKeyId=${selectedKeyId}&limit=20`);
      if (!res.ok) throw new Error('Failed to load requests');

      const data = await res.json();
      setRecentRequests(data.data || data.logs || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  }, [selectedKeyId]);

  const checkDebugMode = useCallback(async () => {
    if (!selectedKeyId) return;

    try {
      const res = await fetch(`/api/admin/debug/mode?apiKeyId=${selectedKeyId}`);
      if (!res.ok) return;

      const data = await res.json();
      setDebugModeEnabled(data.data.debugModeEnabled);
    } catch (error) {
      console.error('Error checking debug mode:', error);
    }
  }, [selectedKeyId]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  useEffect(() => {
    if (selectedKeyId) {
      loadRecentRequests();
      checkDebugMode();
    }
  }, [selectedKeyId, loadRecentRequests, checkDebugMode]);

  async function enableDebugMode() {
    if (!selectedKeyId) return;

    try {
      const res = await fetch('/api/admin/debug/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeyId: selectedKeyId,
          durationMinutes: 60,
        }),
      });

      if (!res.ok) throw new Error('Failed to enable debug mode');

      const data = await res.json();

      toast({
        title: 'Debug Mode Enabled',
        description: `Debug mode will expire at ${new Date(data.data.expiresAt).toLocaleTimeString()}`,
      });

      setDebugModeEnabled(true);
    } catch (error) {
      console.error('Error enabling debug mode:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to enable debug mode',
      });
    }
  }

  async function replayRequest() {
    if (!selectedRequestId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a request to replay',
      });
      return;
    }

    setReplaying(true);
    setReplayResult(null);
    setComparison(null);

    try {
      const res = await fetch('/api/admin/debug/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: selectedRequestId }),
      });

      if (!res.ok) throw new Error('Failed to replay request');

      const data = await res.json();
      setReplayResult(data.data);

      toast({
        title: 'Request Replayed',
        description: 'Successfully replayed the request',
      });

      // Load comparison
      await loadComparison(selectedRequestId, data.data.id);
    } catch (error) {
      console.error('Error replaying request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to replay request',
      });
    } finally {
      setReplaying(false);
    }
  }

  async function loadComparison(originalId: string, replayId: string) {
    try {
      const res = await fetch(`/api/admin/debug/compare?original=${originalId}&replay=${replayId}`);
      if (!res.ok) throw new Error('Failed to load comparison');

      const data = await res.json();
      setComparison(data.data);
    } catch (error) {
      console.error('Error loading comparison:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedRequest = recentRequests.find(r => r.id === selectedRequestId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Request Replay & Debugging</h1>
        <p className="text-muted-foreground mt-2">
          Replay historical requests and compare results
        </p>
      </div>

      {/* API Key Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select API Key</CardTitle>
          <CardDescription>
            Choose an API key to view and replay its requests
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Select value={selectedKeyId} onValueChange={setSelectedKeyId} className="flex-1">
            <SelectTrigger>
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
            variant={debugModeEnabled ? 'default' : 'outline'}
            onClick={enableDebugMode}
            disabled={!selectedKeyId || debugModeEnabled}
          >
            <Bug className="h-4 w-4 mr-2" />
            {debugModeEnabled ? 'Debug Mode Active' : 'Enable Debug Mode'}
          </Button>
        </CardContent>
      </Card>

      {selectedKeyId && (
        <>
          {/* Recent Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Requests</CardTitle>
              <CardDescription>
                Select a request to replay and analyze
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentRequests.map(request => (
                  <div
                    key={request.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:border-primary transition-colors ${
                      selectedRequestId === request.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedRequestId(request.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={request.statusCode && request.statusCode < 400 ? 'default' : 'destructive'}>
                        {request.statusCode || 'N/A'}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{request.model || 'Unknown Model'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <p className="font-medium">{request.latencyMs || 0}ms</p>
                        <p className="text-xs text-muted-foreground">Latency</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCost(request.cost || 0)}</p>
                        <p className="text-xs text-muted-foreground">Cost</p>
                      </div>
                    </div>
                  </div>
                ))}

                {recentRequests.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <p>No recent requests found</p>
                    <p className="text-sm">Make some API calls to see them here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Replay Controls */}
          {selectedRequestId && selectedRequest && (
            <Card>
              <CardHeader>
                <CardTitle>Replay Controls</CardTitle>
                <CardDescription>
                  Replay the selected request with the same parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Model</p>
                      <p className="font-medium">{selectedRequest.model || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Original Latency</p>
                      <p className="font-medium">{selectedRequest.latencyMs || 0}ms</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Original Cost</p>
                      <p className="font-medium">{formatCost(selectedRequest.cost || 0)}</p>
                    </div>
                  </div>

                  <Button onClick={replayRequest} disabled={replaying} className="w-full">
                    {replaying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Replaying...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Replay Request
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comparison Results */}
          {comparison && replayResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5" />
                  Comparison Results
                </CardTitle>
                <CardDescription>
                  Differences between original and replayed request
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Latency Comparison */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Latency</h4>
                      </div>
                      <Badge variant={comparison.differences.latency.percentChange < 0 ? 'default' : 'destructive'}>
                        {comparison.differences.latency.percentChange > 0 && '+'}
                        {comparison.differences.latency.percentChange.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Original</p>
                        <p className="font-medium">{comparison.differences.latency.original}ms</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Replayed</p>
                        <p className="font-medium">{comparison.differences.latency.replayed}ms</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Difference</p>
                        <p className={`font-medium flex items-center gap-1 ${
                          comparison.differences.latency.diff < 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {comparison.differences.latency.diff < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {Math.abs(comparison.differences.latency.diff)}ms
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cost Comparison */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Cost</h4>
                      </div>
                      <Badge variant={comparison.differences.cost.percentChange < 0 ? 'default' : 'destructive'}>
                        {comparison.differences.cost.percentChange > 0 && '+'}
                        {comparison.differences.cost.percentChange.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Original</p>
                        <p className="font-medium">{formatCost(comparison.differences.cost.original)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Replayed</p>
                        <p className="font-medium">{formatCost(comparison.differences.cost.replayed)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Difference</p>
                        <p className={`font-medium flex items-center gap-1 ${
                          comparison.differences.cost.diff < 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {comparison.differences.cost.diff < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {formatCost(Math.abs(comparison.differences.cost.diff))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Response Similarity */}
                  {comparison.differences.response.similarity !== undefined && (
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Response Similarity</h4>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${comparison.differences.response.similarity * 100}%` }}
                          />
                        </div>
                        <span className="font-medium">
                          {(comparison.differences.response.similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {comparison.differences.response.similarity > 0.9
                          ? 'Responses are nearly identical'
                          : comparison.differences.response.similarity > 0.7
                          ? 'Responses are similar with minor differences'
                          : 'Responses differ significantly'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
