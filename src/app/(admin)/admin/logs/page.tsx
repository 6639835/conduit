'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  DataTable,
  type Column,
  type TableFilter,
  SkeletonTable,
} from '@/components/ui';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface LogEntry {
  id: string;
  timestamp: string;
  apiKeyId: string;
  keyPrefix: string | null;
  method: string;
  path: string;
  model: string;
  statusCode: number;
  statusCategory: string; // Added for filtering
  errorMessage: string | null;
  latencyMs: number | null;
  userAgent: string | null;
  ipAddress: string | null;
  country: string | null;
}

const getStatusCategory = (statusCode: number): string => {
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 400 && statusCode < 500) return 'client_error';
  if (statusCode >= 500) return 'server_error';
  return 'other';
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<'all' | 'errors'>('errors');
  const [timeRange, setTimeRange] = useState(7);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/logs?type=${logType}&days=${timeRange}&limit=200`
      );
      const data = await response.json();

      if (data.success) {
        // Add status category for filtering
        const logsWithCategory = data.logs.map((log: LogEntry) => ({
          ...log,
          statusCategory: getStatusCategory(log.statusCode),
        }));
        setLogs(logsWithCategory);
      } else {
        toast.error('Failed to fetch logs', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to fetch logs', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [logType, timeRange]);

  const getStatusIcon = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <CheckCircle className="h-4 w-4 text-success" />;
    } else if (statusCode >= 400) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return 'bg-success/20 text-success';
    } else if (statusCode >= 400 && statusCode < 500) {
      return 'bg-warning/20 text-warning';
    } else if (statusCode >= 500) {
      return 'bg-destructive/20 text-destructive';
    }
    return 'bg-muted text-muted-foreground';
  };

  const columns: Column<LogEntry>[] = [
    {
      key: 'timestamp',
      header: 'Time',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-3 w-3 text-muted-foreground" />
          {new Date(row.timestamp).toLocaleString()}
        </div>
      ),
    },
    {
      key: 'statusCode',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(row.statusCode)}
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(row.statusCode)}`}
          >
            {row.statusCode}
          </span>
        </div>
      ),
    },
    {
      key: 'keyPrefix',
      header: 'API Key',
      render: (row) => (
        <code className="text-xs bg-muted px-2 py-1 rounded">
          {row.keyPrefix || 'Unknown'}
        </code>
      ),
    },
    {
      key: 'path',
      header: 'Endpoint',
      render: (row) => (
        <div className="text-sm">
          <span className="font-medium">{row.method}</span>{' '}
          <span className="text-muted-foreground">{row.path}</span>
        </div>
      ),
    },
    {
      key: 'model',
      header: 'Model',
      sortable: true,
      render: (row) => (
        <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">
          {row.model || 'N/A'}
        </span>
      ),
    },
    {
      key: 'latencyMs',
      header: 'Latency',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.latencyMs ? `${row.latencyMs}ms` : '-'}
        </span>
      ),
    },
    {
      key: 'errorMessage',
      header: 'Error',
      render: (row) => (
        <span className="text-xs text-destructive truncate max-w-xs block">
          {row.errorMessage || '-'}
        </span>
      ),
    },
  ];

  const errorCount = logs.filter((log) => log.statusCode >= 400).length;
  const successCount = logs.filter(
    (log) => log.statusCode >= 200 && log.statusCode < 300
  ).length;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Request Logs</h1>
            <p className="text-muted-foreground">
              View and analyze API request logs and errors
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={logType}
              onChange={(e) => setLogType(e.target.value as 'all' | 'errors')}
            >
              <option value="errors">Errors Only</option>
              <option value="all">All Requests</option>
            </Select>
            <Select
              value={timeRange.toString()}
              onChange={(e) => setTimeRange(parseInt(e.target.value))}
            >
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </Select>
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Logs</p>
                  <p className="text-2xl font-bold">{logs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Successful</p>
                  <p className="text-2xl font-bold text-success">{successCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="text-2xl font-bold text-destructive">{errorCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {logType === 'errors' ? 'Error Logs' : 'All Request Logs'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={10} />
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No logs found</p>
                <p className="text-sm">
                  {logType === 'errors'
                    ? 'Great news! No errors in the selected time period.'
                    : 'No requests have been made in the selected time period.'}
                </p>
              </div>
            ) : (
              <DataTable
                data={logs}
                columns={columns}
                searchable
                searchPlaceholder="Search by path, model, or error..."
                filters={[
                  {
                    key: 'statusCategory',
                    label: 'Status',
                    options: [
                      { label: '2xx Success', value: 'success' },
                      { label: '4xx Client Error', value: 'client_error' },
                      { label: '5xx Server Error', value: 'server_error' },
                    ],
                  },
                  {
                    key: 'method',
                    label: 'Method',
                    options: [
                      { label: 'POST', value: 'POST' },
                      { label: 'GET', value: 'GET' },
                    ],
                  },
                ] as TableFilter[]}
                pageSize={20}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
