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
import { Loader2, Shield, AlertTriangle, TrendingUp, Clock, Key, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  name: string | null;
  keyPrefix: string;
}

interface BehavioralPattern {
  apiKeyId: string;
  keyPrefix: string;
  metrics: {
    avgRequestsPerHour: number;
    avgRequestsPerDay: number;
    peakHour: number;
    commonModels: string[];
    commonIpAddresses: string[];
    avgCostPerRequest: number;
    errorRate: number;
  };
  anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    detectedAt: Date;
  }>;
  riskScore: number;
  lastUpdated: Date;
}

export default function SecurityPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [behavioralPattern, setBehavioralPattern] = useState<BehavioralPattern | null>(null);

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

  const loadBehavioralAnalysis = useCallback(async (forceRefresh = false) => {
    if (!selectedKeyId) return;

    setAnalyzing(true);
    try {
      const res = await fetch(
        `/api/admin/security/behavioral?apiKeyId=${selectedKeyId}${forceRefresh ? '&refresh=true' : ''}`
      );
      if (!res.ok) throw new Error('Failed to load analysis');

      const data = await res.json();
      setBehavioralPattern(data.data.pattern);
    } catch (error) {
      console.error('Error loading analysis:', error);
      setBehavioralPattern(null);
    } finally {
      setAnalyzing(false);
    }
  }, [selectedKeyId]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  useEffect(() => {
    if (selectedKeyId) {
      loadBehavioralAnalysis();
    }
  }, [selectedKeyId, loadBehavioralAnalysis]);

  async function scheduleRotation() {
    if (!selectedKeyId) return;

    try {
      const res = await fetch('/api/admin/security/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeyId: selectedKeyId,
          intervalDays: 90,
        }),
      });

      if (!res.ok) throw new Error('Failed to schedule rotation');

      const data = await res.json();

      toast({
        title: 'Rotation Scheduled',
        description: `Key will rotate every 90 days. Next rotation: ${new Date(
          data.data.nextRotation
        ).toLocaleDateString()}`,
      });
    } catch (error) {
      console.error('Error scheduling rotation:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to schedule key rotation',
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 75) return 'text-red-600';
    if (score >= 50) return 'text-orange-600';
    if (score >= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor behavioral patterns, detect anomalies, and manage key rotation
        </p>
      </div>

      {/* API Key Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select API Key</CardTitle>
          <CardDescription>
            Analyze security metrics for a specific API key
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
            variant="outline"
            onClick={() => loadBehavioralAnalysis(true)}
            disabled={!selectedKeyId || analyzing}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {selectedKeyId && behavioralPattern && (
        <>
          {/* Risk Score Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getRiskColor(behavioralPattern.riskScore)}`}>
                  {behavioralPattern.riskScore}/100
                </div>
                <p className="text-xs text-muted-foreground">
                  {behavioralPattern.riskScore >= 75
                    ? 'High risk'
                    : behavioralPattern.riskScore >= 50
                    ? 'Medium risk'
                    : 'Low risk'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{behavioralPattern.anomalies.length}</div>
                <p className="text-xs text-muted-foreground">Detected issues</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(behavioralPattern.metrics.errorRate * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Failed requests</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Cost</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${behavioralPattern.metrics.avgCostPerRequest.toFixed(4)}
                </div>
                <p className="text-xs text-muted-foreground">Per request</p>
              </CardContent>
            </Card>
          </div>

          {/* Anomalies */}
          {behavioralPattern.anomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detected Anomalies</CardTitle>
                <CardDescription>
                  Unusual patterns and potential security issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {behavioralPattern.anomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-3 h-3 rounded-full mt-1 ${getSeverityColor(anomaly.severity)}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="capitalize">
                              {anomaly.type.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant={
                              anomaly.severity === 'critical' ? 'destructive' :
                              anomaly.severity === 'high' ? 'default' : 'secondary'
                            }>
                              {anomaly.severity}
                            </Badge>
                          </div>
                          <p className="text-sm">{anomaly.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Detected: {new Date(anomaly.detectedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Patterns</CardTitle>
              <CardDescription>
                Behavioral metrics for the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Average Requests</p>
                    <p className="text-lg font-medium">
                      {behavioralPattern.metrics.avgRequestsPerHour.toFixed(1)} / hour
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {behavioralPattern.metrics.avgRequestsPerDay.toFixed(0)} / day
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Peak Hour</p>
                    <p className="text-lg font-medium">
                      {behavioralPattern.metrics.peakHour}:00 - {behavioralPattern.metrics.peakHour + 1}:00
                    </p>
                    <p className="text-sm text-muted-foreground">Most active period</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Common Models</p>
                  <div className="flex flex-wrap gap-2">
                    {behavioralPattern.metrics.commonModels.map(model => (
                      <Badge key={model} variant="secondary">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Common IP Addresses</p>
                  <div className="flex flex-wrap gap-2">
                    {behavioralPattern.metrics.commonIpAddresses.map(ip => (
                      <Badge key={ip} variant="outline" className="font-mono text-xs">
                        {ip}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Rotation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Automated Key Rotation
              </CardTitle>
              <CardDescription>
                Schedule automatic key rotation to enhance security
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Automatic key rotation helps prevent unauthorized access by regularly
                  generating new API keys. Recommended interval: 90 days.
                </p>
                <Button onClick={scheduleRotation}>
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule 90-Day Rotation
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedKeyId && !behavioralPattern && !analyzing && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>No behavioral data available yet</p>
            <p className="text-sm">Make some API calls to generate security metrics</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
