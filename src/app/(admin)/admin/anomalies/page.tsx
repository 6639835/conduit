'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Select,
  AlertCard,
} from '@/components/ui';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface Anomaly {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  threshold: number;
  timestamp: Date;
  apiKeyId?: string;
  message: string;
  details: {
    zScore?: number;
    movingAverage?: number;
    standardDeviation?: number;
    percentageChange?: number;
  };
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(7);

  const handleDetectAnomalies = async () => {
    setLoading(true);
    try {
      toast.info('Running anomaly detection...', {
        description: 'This may take a few moments',
      });

      // Simulate API call for demo
      // In production, this would call the cron endpoint or a dedicated API
      setTimeout(() => {
        // Mock data for demonstration
        const mockAnomalies: Anomaly[] = [
          {
            type: 'usage_spike',
            severity: 'high',
            metric: 'requests',
            currentValue: 15420,
            expectedValue: 8250,
            deviation: 3.8,
            threshold: 3,
            timestamp: new Date(),
            message: 'Spike detected: 15420 vs expected 8250',
            details: {
              zScore: 3.8,
              percentageChange: 86.9,
            },
          },
          {
            type: 'cost_spike',
            severity: 'critical',
            metric: 'cost',
            currentValue: 245.50,
            expectedValue: 120.30,
            deviation: 4.2,
            threshold: 3,
            timestamp: new Date(Date.now() - 3600000),
            message: 'Cost spike: $245.50 vs expected $120.30',
            details: {
              percentageChange: 104.1,
            },
          },
          {
            type: 'error_rate_spike',
            severity: 'medium',
            metric: 'error_rate',
            currentValue: 8.5,
            expectedValue: 2.1,
            deviation: 2.9,
            threshold: 2.5,
            timestamp: new Date(Date.now() - 7200000),
            message: 'Error rate spike: 8.50% vs expected 2.10%',
            details: {
              percentageChange: 304.8,
            },
          },
        ];

        setAnomalies(mockAnomalies);
        toast.success('Anomaly detection complete', {
          description: `Found ${mockAnomalies.length} anomalies`,
        });
        setLoading(false);
      }, 2000);
    } catch {
      toast.error('Failed to detect anomalies', {
        description: 'An unexpected error occurred',
      });
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-700 border-red-500';
      case 'high':
        return 'bg-orange-500/10 text-orange-700 border-orange-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500';
      case 'low':
        return 'bg-blue-500/10 text-blue-700 border-blue-500';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <XCircle className="h-5 w-5" />;
      case 'medium':
        return <AlertTriangle className="h-5 w-5" />;
      case 'low':
        return <Info className="h-5 w-5" />;
      default:
        return <CheckCircle className="h-5 w-5" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'usage_spike':
        return <TrendingUp className="h-5 w-5" />;
      case 'usage_drop':
        return <TrendingDown className="h-5 w-5" />;
      case 'cost_spike':
        return <DollarSign className="h-5 w-5" />;
      case 'error_rate_spike':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const anomaliesBySecurityvity = {
    critical: anomalies.filter(a => a.severity === 'critical').length,
    high: anomalies.filter(a => a.severity === 'high').length,
    medium: anomalies.filter(a => a.severity === 'medium').length,
    low: anomalies.filter(a => a.severity === 'low').length,
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-8 w-8" />
              Anomaly Detection
            </h1>
            <p className="text-muted-foreground">
              AI-powered detection of unusual patterns in usage, cost, and errors
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={lookbackDays.toString()}
              onChange={(e) => setLookbackDays(parseInt(e.target.value))}
            >
              <option value="3">Last 3 days</option>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </Select>
            <Button onClick={handleDetectAnomalies} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Detect Anomalies
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <AlertCard variant="info">
          <p className="text-sm">
            Anomaly detection uses statistical algorithms (Z-score, moving averages, exponential
            smoothing) to identify unusual patterns in your API usage. Critical and high-severity
            anomalies trigger automatic notifications.
          </p>
        </AlertCard>

        {/* Summary Cards */}
        {anomalies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Critical</p>
                    <p className="text-2xl font-bold text-red-600">
                      {anomaliesBySecurityvity.critical}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">High</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {anomaliesBySecurityvity.high}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Medium</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {anomaliesBySecurityvity.medium}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Low</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {anomaliesBySecurityvity.low}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Info className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Anomalies List */}
        {anomalies.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Detected Anomalies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {anomalies
                  .sort((a, b) => {
                    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                    return severityOrder[b.severity] - severityOrder[a.severity];
                  })
                  .map((anomaly, index) => (
                    <div
                      key={index}
                      className={`border-l-4 rounded-lg p-4 ${getSeverityColor(anomaly.severity)}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-0.5">{getTypeIcon(anomaly.type)}</div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{anomaly.message}</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-current/20">
                                {getTypeLabel(anomaly.type)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground text-xs">Current Value</p>
                                <p className="font-medium">
                                  {anomaly.metric === 'cost' && '$'}
                                  {anomaly.currentValue.toFixed(2)}
                                  {anomaly.metric === 'error_rate' && '%'}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Expected Value</p>
                                <p className="font-medium">
                                  {anomaly.metric === 'cost' && '$'}
                                  {anomaly.expectedValue.toFixed(2)}
                                  {anomaly.metric === 'error_rate' && '%'}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Deviation</p>
                                <p className="font-medium">{anomaly.deviation.toFixed(2)}σ</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Change</p>
                                <p className="font-medium">
                                  {anomaly.details.percentageChange
                                    ? `${anomaly.details.percentageChange > 0 ? '+' : ''}${anomaly.details.percentageChange.toFixed(1)}%`
                                    : 'N/A'}
                                </p>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              Detected: {new Date(anomaly.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getSeverityIcon(anomaly.severity)}
                          <span className="text-xs font-semibold uppercase">
                            {anomaly.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Anomalies Detected</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {loading
                    ? 'Analyzing your data for anomalies...'
                    : 'Click "Detect Anomalies" to analyze your recent API usage for unusual patterns.'}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle>How Anomaly Detection Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-accent">1</span>
                </div>
                <h4 className="font-semibold">Statistical Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  Uses Z-score, moving averages, and exponential smoothing to establish baseline
                  behavior patterns.
                </p>
              </div>

              <div className="space-y-2">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-accent">2</span>
                </div>
                <h4 className="font-semibold">Real-time Detection</h4>
                <p className="text-sm text-muted-foreground">
                  Monitors usage, cost, and error rates in real-time, comparing current values
                  against expected patterns.
                </p>
              </div>

              <div className="space-y-2">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-accent">3</span>
                </div>
                <h4 className="font-semibold">Smart Alerts</h4>
                <p className="text-sm text-muted-foreground">
                  Automatically notifies you of critical and high-severity anomalies via Slack,
                  Discord, or in-app notifications.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
