'use client';

import { useState, useEffect } from 'react';
import type { ListApiKeysResponse, CreateApiKeyResponse } from '@/types';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  DataTable,
  type Column,
  AlertCard,
  SkeletonTable,
  useToast,
} from '@/components/ui';
import {
  Plus,
  Copy,
  Check,
  X,
  Key,
  Shield,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  name: string | null;
  provider: string;
  isActive: boolean;
  createdAt: string;
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerDay: number;
}

export default function AdminKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    provider: 'official',
    targetApiKey: '',
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    tokensPerDay: 1000000,
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/admin/keys');
      const data: ListApiKeysResponse = await response.json();
      if (data.success && data.apiKeys) {
        setKeys(data.apiKeys as ApiKeyRow[]);
      }
    } catch {
      addToast({
        title: 'Error',
        description: 'Failed to fetch API keys',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data: CreateApiKeyResponse = await response.json();

      if (data.success && data.apiKey) {
        setCreatedKey(data.apiKey.fullKey);
        setShowCreateForm(false);
        fetchKeys();
        setFormData({
          name: '',
          provider: 'official',
          targetApiKey: '',
          requestsPerMinute: 60,
          requestsPerDay: 1000,
          tokensPerDay: 1000000,
        });
        addToast({
          title: 'Success',
          description: 'API key created successfully',
          variant: 'success',
        });
      } else {
        addToast({
          title: 'Error',
          description: data.error || 'Failed to create API key',
          variant: 'error',
        });
      }
    } catch {
      addToast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    try {
      const response = await fetch(`/api/admin/keys/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchKeys();
        addToast({
          title: 'Success',
          description: 'API key revoked successfully',
          variant: 'success',
        });
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to revoke API key',
          variant: 'error',
        });
      }
    } catch {
      addToast({
        title: 'Error',
        description: 'Failed to revoke API key',
        variant: 'error',
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    addToast({
      title: 'Copied',
      description: 'API key copied to clipboard',
      variant: 'success',
    });
  };

  const columns: Column<ApiKeyRow>[] = [
    {
      key: 'keyPrefix',
      header: 'Key',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <code className="font-mono text-sm">{row.keyPrefix}...</code>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => row.name || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'provider',
      header: 'Provider',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs font-medium">
          <Shield className="h-3 w-3" />
          {row.provider}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            row.isActive
              ? 'bg-success/20 text-success'
              : 'bg-destructive/20 text-destructive'
          }`}
        >
          {row.isActive ? (
            <>
              <Check className="h-3 w-3" />
              Active
            </>
          ) : (
            <>
              <X className="h-3 w-3" />
              Revoked
            </>
          )}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(row.createdAt).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: 'limits',
      header: 'Limits',
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          {row.requestsPerMinute}/min • {row.requestsPerDay}/day •{' '}
          {Number(row.tokensPerDay).toLocaleString()} tokens
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRevokeKey(row.id)}
            className="text-destructive border-destructive hover:bg-destructive hover:text-white"
          >
            Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">API Key Management</h1>
            <p className="text-muted-foreground">
              Create, view, and manage API keys for your Claude gateway
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Key
          </Button>
        </div>

        {/* Created Key Display */}
        {createdKey && (
          <Card className="border-2 border-accent bg-accent/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="h-5 w-5 text-accent" />
                  API Key Created Successfully!
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCreatedKey(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <AlertCard
                title="Important"
                description="Copy this key now - it will only be shown once!"
                variant="warning"
              />
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-background border border-border rounded-lg font-mono text-sm break-all">
                  {createdKey}
                </code>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(createdKey)}
                >
                  {copiedKey ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Create New API Key</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateKey} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Name (optional)"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="My API Key"
                  />

                  <Select
                    label="Provider"
                    value={formData.provider}
                    onChange={(e) =>
                      setFormData({ ...formData, provider: e.target.value })
                    }
                  >
                    <option value="official">Claude Official API</option>
                    <option value="bedrock">AWS Bedrock</option>
                  </Select>
                </div>

                <Input
                  label="Target Claude API Key"
                  type="password"
                  value={formData.targetApiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, targetApiKey: e.target.value })
                  }
                  placeholder="sk-ant-..."
                  required
                />

                <div className="space-y-4">
                  <h4 className="font-medium">Rate Limits</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Requests per Minute"
                      type="number"
                      value={formData.requestsPerMinute}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requestsPerMinute: parseInt(e.target.value),
                        })
                      }
                    />
                    <Input
                      label="Requests per Day"
                      type="number"
                      value={formData.requestsPerDay}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requestsPerDay: parseInt(e.target.value),
                        })
                      }
                    />
                    <Input
                      label="Tokens per Day"
                      type="number"
                      value={formData.tokensPerDay}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tokensPerDay: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" isLoading={submitting}>
                  <Key className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Keys List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Existing API Keys</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <DataTable
                data={keys}
                columns={columns}
                searchable
                searchPlaceholder="Search by name or key prefix..."
                pageSize={10}
                emptyMessage="No API keys created yet. Click 'Create New Key' to get started."
                rowClassName={(row) =>
                  !row.isActive ? 'opacity-60' : ''
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
