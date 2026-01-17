'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  SkeletonTable,
  Input,
  Select,
} from '@/components/ui';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Download, Filter, RefreshCw } from 'lucide-react';
import { formatCost } from '@/lib/analytics/cost-calculator';
import { toast } from '@/lib/toast';

interface UsageLogRow {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  model: string;
  statusCode: number;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  latencyMs: number | null;
  errorMessage: string | null;
  ipAddress: string | null;
  country: string | null;
  keyPrefix: string | null;
  keyName: string | null;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<UsageLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  const [filters, setFilters] = useState({
    status: 'all',
    model: '',
    keyPrefix: '',
    path: '',
    startDate: '',
    endDate: '',
    query: '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.model) params.append('model', filters.model);
      if (filters.keyPrefix) params.append('keyPrefix', filters.keyPrefix);
      if (filters.path) params.append('path', filters.path);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.query) params.append('q', filters.query);

      const response = await fetch(`/api/admin/usage-logs?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.logs) {
        setLogs(data.logs);
        setPagination((prev) => ({
          ...prev,
          ...data.pagination,
        }));
      }
    } catch {
      toast.error('Failed to fetch request logs', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [filters]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '1000',
      });
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.model) params.append('model', filters.model);
      if (filters.keyPrefix) params.append('keyPrefix', filters.keyPrefix);
      if (filters.path) params.append('path', filters.path);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.query) params.append('q', filters.query);

      const response = await fetch(`/api/admin/usage-logs?${params.toString()}`);
      const data = await response.json();

      const csv = [
        [
          'Timestamp',
          'Key Prefix',
          'Key Name',
          'Method',
          'Path',
          'Model',
          'Status',
          'Latency (ms)',
          'Tokens In',
          'Tokens Out',
          'Cost (cents)',
          'IP',
          'Country',
          'Error',
        ].join(','),
        ...data.logs.map((log: UsageLogRow) => [
          new Date(log.timestamp).toISOString(),
          log.keyPrefix || '',
          log.keyName || '',
          log.method,
          log.path,
          log.model,
          log.statusCode,
          log.latencyMs ?? '',
          log.tokensInput,
          log.tokensOutput,
          log.costUsd,
          log.ipAddress || '',
          log.country || '',
          (log.errorMessage || '').replace(/\n/g, ' '),
        ].join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `request-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast.success('Request logs exported', {
        description: 'The CSV file has been downloaded',
      });
    } catch {
      toast.error('Failed to export request logs', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const statusBadge = (statusCode: number) => {
    if (statusCode < 400) return 'bg-success/20 text-success';
    return 'bg-destructive/20 text-destructive';
  };

  const modelOptions = Array.from(new Set(logs.map((log) => log.model))).sort();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Request Logs</h1>
            <p className="text-muted-foreground">
              Inspect recent API traffic, errors, and latency details
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Search"
                placeholder="Model, path, error, key prefix"
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              />
              <Input
                label="Key Prefix"
                placeholder="sk-cond_"
                value={filters.keyPrefix}
                onChange={(e) => setFilters({ ...filters, keyPrefix: e.target.value })}
              />
              <Input
                label="Path"
                placeholder="/v1/messages"
                value={filters.path}
                onChange={(e) => setFilters({ ...filters, path: e.target.value })}
              />
              <div>
                <label className="mb-2 block text-sm font-medium">Status</label>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Model</label>
                <Select
                  value={filters.model}
                  onChange={(e) => setFilters({ ...filters, model: e.target.value })}
                >
                  <option value="">All</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
              <Input
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setFilters({
                    status: 'all',
                    model: '',
                    keyPrefix: '',
                    path: '',
                    startDate: '',
                    endDate: '',
                    query: '',
                  })}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={10} />
            ) : logs.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No request logs found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Path</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{log.keyPrefix || '—'}</div>
                          <div className="text-xs text-muted-foreground">{log.keyName || 'Unnamed'}</div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{log.model}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusBadge(log.statusCode)}`}>
                            {log.statusCode}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.latencyMs ? `${log.latencyMs} ms` : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(log.tokensInput + log.tokensOutput).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatCost(log.costUsd)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.path}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={!pagination.hasMore}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
