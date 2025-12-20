'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  DataTable,
  type Column,
  SkeletonTable,
} from '@/components/ui';
import {
  FileText,
  User,
  Calendar,
  Filter,
  Download,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface AuditLog {
  id: string;
  adminEmail: string;
  resourceType: string;
  resourceId: string;
  action: string;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  timestamp: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  const [filters, setFilters] = useState({
    adminEmail: '',
    resourceType: '',
    action: '',
    startDate: '',
    endDate: '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        ),
      });

      const response = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await response.json();

      if (data.logs) {
        setLogs(data.logs);
        setPagination((prev) => ({
          ...prev,
          ...data.pagination,
        }));
      }
    } catch {
      toast.error('Failed to fetch audit logs', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        ),
      });

      const response = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await response.json();

      // Convert to CSV
      const csv = [
        ['Timestamp', 'Admin Email', 'Resource Type', 'Resource ID', 'Action', 'IP Address', 'Changes'].join(','),
        ...data.logs.map((log: AuditLog) => [
          new Date(log.timestamp).toISOString(),
          log.adminEmail,
          log.resourceType,
          log.resourceId,
          log.action,
          log.ipAddress || '',
          JSON.stringify(log.changes || {}),
        ].join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast.success('Audit logs exported successfully', {
        description: 'The CSV file has been downloaded',
      });
    } catch {
      toast.error('Failed to export audit logs', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-success/20 text-success';
      case 'update':
        return 'bg-accent/20 text-accent';
      case 'delete':
      case 'revoke':
        return 'bg-destructive/20 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span>{new Date(row.timestamp).toLocaleString()}</span>
        </div>
      ),
    },
    {
      key: 'adminEmail',
      header: 'Admin',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1 text-sm">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{row.adminEmail}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium uppercase ${getActionBadgeColor(
            row.action
          )}`}
        >
          {row.action}
        </span>
      ),
    },
    {
      key: 'resourceType',
      header: 'Resource Type',
      sortable: true,
      render: (row) => (
        <span className="text-sm">{row.resourceType}</span>
      ),
    },
    {
      key: 'resourceId',
      header: 'Resource ID',
      render: (row) => (
        <code className="text-xs bg-muted px-2 py-1 rounded">
          {row.resourceId.substring(0, 8)}...
        </code>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (row) => (
        <span className="text-sm text-muted-foreground font-mono">
          {row.ipAddress || '-'}
        </span>
      ),
    },
    {
      key: 'changes',
      header: 'Changes',
      render: (row) => (
        row.changes ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-accent hover:underline">
              View
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-w-md">
              {JSON.stringify(row.changes, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground">
              View all administrative actions and changes
            </p>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Admin Email</label>
                <input
                  type="email"
                  value={filters.adminEmail}
                  onChange={(e) => setFilters({ ...filters, adminEmail: e.target.value })}
                  placeholder="admin@example.com"
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Resource Type</label>
                <select
                  value={filters.resourceType}
                  onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">All Types</option>
                  <option value="api_key">API Key</option>
                  <option value="organization">Organization</option>
                  <option value="project">Project</option>
                  <option value="provider">Provider</option>
                  <option value="user">User</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Action</label>
                <select
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">All Actions</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="revoke">Revoke</option>
                  <option value="rotate">Rotate</option>
                  <option value="enable_2fa">Enable 2FA</option>
                  <option value="disable_2fa">Disable 2FA</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({
                    adminEmail: '',
                    resourceType: '',
                    action: '',
                    startDate: '',
                    endDate: '',
                  })}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={10} />
            ) : (
              <>
                <DataTable
                  data={logs}
                  columns={columns}
                  pageSize={pagination.limit}
                  emptyMessage="No audit logs found. Try adjusting your filters."
                />

                {/* Pagination */}
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
