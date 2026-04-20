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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, TrendingDown, TrendingUp, Zap, Shield, DollarSign, Gauge } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  name: string | null;
  keyPrefix: string;
}

interface Recommendation {
  currentProvider: string;
  recommendedProvider: string;
  potentialSavings: number;
  reason: string;
}

interface RoutingConfig {
  enabled: boolean;
  preferences: {
    optimizeFor: 'cost' | 'quality' | 'speed' | 'balanced';
    maxCostPerRequest?: number;
    preferredProvider?: 'claude' | 'openai' | 'gemini';
    requireRegion?: string;
    allowFallback: boolean;
  };
  learningEnabled: boolean;
  overrideModel?: string;
}

export default function RoutingPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [config, setConfig] = useState<RoutingConfig>({
    enabled: false,
    preferences: {
      optimizeFor: 'balanced',
      allowFallback: true,
    },
    learningEnabled: false,
  });
  const [savingsStats, setSavingsStats] = useState({
    total: 0,
    monthly: 0,
  });

  const loadApiKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/keys?limit=100');
      if (!res.ok) throw new Error('Failed to load API keys');

      const data = await res.json();
      setApiKeys(data.apiKeys || []);

      if (data.apiKeys?.length > 0 && !selectedKeyId) {
        setSelectedKeyId(data.apiKeys[0].id);
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

  const loadRoutingConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/routing/config?apiKeyId=${selectedKeyId}`);
      if (!res.ok) throw new Error('Failed to load config');

      const data = await res.json();
      setConfig(data.data);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }, [selectedKeyId]);

  const loadRecommendations = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/routing/recommendations?apiKeyId=${selectedKeyId}&days=30`);
      if (!res.ok) throw new Error('Failed to load recommendations');

      const data = await res.json();
      setRecommendations(data.data.recommendations || []);
      setSavingsStats({
        total: data.data.totalPotentialSavings || 0,
        monthly: data.data.monthlySavingsEstimate || 0,
      });
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  }, [selectedKeyId]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  useEffect(() => {
    if (selectedKeyId) {
      loadRoutingConfig();
      loadRecommendations();
    }
  }, [selectedKeyId, loadRoutingConfig, loadRecommendations]);

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/routing/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeyId: selectedKeyId, config }),
      });

      if (!res.ok) throw new Error('Failed to save config');

      toast({
        title: 'Success',
        description: 'Routing configuration saved successfully',
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save configuration',
      });
    } finally {
      setSaving(false);
    }
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
        <h1 className="text-3xl font-bold tracking-tight">Intelligent Routing</h1>
        <p className="text-muted-foreground mt-2">
          AI-powered cost optimization and intelligent provider selection
        </p>
      </div>

      {/* API Key Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select API Key</CardTitle>
          <CardDescription>
            Configure intelligent routing for a specific API key
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
            <SelectTrigger className="w-full">
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
        </CardContent>
      </Card>

      {selectedKeyId && (
        <>
          {/* Cost Savings Overview */}
          {recommendations.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
                  <TrendingDown className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${savingsStats.total.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Estimate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${savingsStats.monthly.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Projected monthly savings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
                  <Zap className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{recommendations.length}</div>
                  <p className="text-xs text-muted-foreground">Optimization opportunities</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Routing Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Auto-Routing Configuration</CardTitle>
              <CardDescription>
                Enable intelligent routing to automatically select optimal providers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled">Enable Intelligent Routing</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically route requests to optimal providers
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, enabled: checked })
                  }
                />
              </div>

              {/* Optimization Strategy */}
              <div className="space-y-2">
                <Label>Optimization Strategy</Label>
                <Select
                  value={config.preferences.optimizeFor}
                  onValueChange={value =>
                    setConfig({
                      ...config,
                      preferences: {
                        ...config.preferences,
                        optimizeFor: value as RoutingConfig['preferences']['optimizeFor'],
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cost">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span>Cost - Minimize expenses</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="quality">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>Quality - Best performance</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="speed">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        <span>Speed - Fastest response</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="balanced">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4" />
                        <span>Balanced - Best overall value</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preferred Provider */}
              <div className="space-y-2">
                <Label>Preferred Provider (Optional)</Label>
                <Select
                  value={config.preferences.preferredProvider || 'none'}
                  onValueChange={(value) =>
                    setConfig({
                      ...config,
                      preferences: {
                        ...config.preferences,
                        preferredProvider: value === 'none'
                          ? undefined
                          : (value as RoutingConfig['preferences']['preferredProvider']),
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preference</SelectItem>
                    <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Gemini (Google)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Max Cost Per Request */}
              <div className="space-y-2">
                <Label>Max Cost Per Request (Optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 0.10"
                  value={config.preferences.maxCostPerRequest || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      preferences: {
                        ...config.preferences,
                        maxCostPerRequest: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Limit maximum cost per request in USD
                </p>
              </div>

              {/* Allow Fallback */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="fallback">Allow Fallback</Label>
                  <p className="text-sm text-muted-foreground">
                    Use alternative providers if preferred is unavailable
                  </p>
                </div>
                <Switch
                  id="fallback"
                  checked={config.preferences.allowFallback}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      preferences: { ...config.preferences, allowFallback: checked },
                    })
                  }
                />
              </div>

              {/* Learning Mode */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="learning">Enable Learning Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Continuously improve routing based on historical performance
                  </p>
                </div>
                <Switch
                  id="learning"
                  checked={config.learningEnabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, learningEnabled: checked })
                  }
                />
              </div>

              <Button onClick={saveConfig} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Configuration'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cost Optimization Recommendations</CardTitle>
                <CardDescription>
                  Based on usage analysis from the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between border rounded-lg p-4"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{rec.currentProvider}</Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="default">{rec.recommendedProvider}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.reason}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600">
                          ${rec.potentialSavings.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">potential savings</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recommendations.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <p>No recommendations available yet.</p>
                  <p className="text-sm">Generate more usage to see optimization suggestions.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
