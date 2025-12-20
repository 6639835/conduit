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
  type TableFilter,
  AlertCard,
  SkeletonTable,
} from '@/components/ui';
import {
  Plus,
  Copy,
  Check,
  X,
  Key,
  Shield,
  Clock,
  Edit,
} from 'lucide-react';
import { toast } from '@/lib/toast';

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
  monthlySpendLimitUsd: number | null;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isDefault?: boolean;
  defaultRateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
    tokensPerDay: number;
  };
}

export default function AdminKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyRow | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    provider: '',
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    tokensPerDay: 1000000,
    monthlySpendLimitUsd: 100,
    expiresAt: '',
    ipWhitelist: '',
    ipBlacklist: '',
    allowedModels: '',
    allowedEndpoints: '',
    organizationId: '',
    projectId: '',
  });

  useEffect(() => {
    fetchKeys();
    fetchProviders();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/admin/keys');
      const data: ListApiKeysResponse = await response.json();
      if (data.success && data.apiKeys) {
        setKeys(data.apiKeys as ApiKeyRow[]);
      }
    } catch {
      toast.error('Failed to fetch API keys', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/providers');
      const data = await response.json();
      if (data.success && data.providers) {
        const activeProviders = data.providers.filter((p: Provider) => p.isActive);
        setProviders(activeProviders);

        // Set default provider as the initial selection
        const defaultProvider = activeProviders.find((p: Provider) => p.isDefault);
        if (defaultProvider) {
          setFormData((prev) => ({
            ...prev,
            provider: defaultProvider.id,
            requestsPerMinute: defaultProvider.defaultRateLimits.requestsPerMinute,
            requestsPerDay: defaultProvider.defaultRateLimits.requestsPerDay,
            tokensPerDay: defaultProvider.defaultRateLimits.tokensPerDay,
          }));
        }
      }
    } catch {
      toast.error('Failed to fetch providers', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Prepare the payload with proper formatting
      const payload = {
        ...formData,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        ipWhitelist: formData.ipWhitelist ? formData.ipWhitelist.split('\n').filter(Boolean) : null,
        ipBlacklist: formData.ipBlacklist ? formData.ipBlacklist.split('\n').filter(Boolean) : null,
        allowedModels: formData.allowedModels ? formData.allowedModels.split(',').map(m => m.trim()).filter(Boolean) : null,
        allowedEndpoints: formData.allowedEndpoints ? formData.allowedEndpoints.split(',').map(e => e.trim()).filter(Boolean) : null,
      };

      const response = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: CreateApiKeyResponse = await response.json();

      if (data.success && data.apiKey) {
        setCreatedKey(data.apiKey.fullKey);
        setShowCreateForm(false);
        fetchKeys();
        const defaultProvider = providers.find((p: Provider) => p.isDefault);
        setFormData({
          name: '',
          provider: defaultProvider?.id || '',
          requestsPerMinute: defaultProvider?.defaultRateLimits.requestsPerMinute || 60,
          requestsPerDay: defaultProvider?.defaultRateLimits.requestsPerDay || 1000,
          tokensPerDay: defaultProvider?.defaultRateLimits.tokensPerDay || 1000000,
          monthlySpendLimitUsd: 100,
          expiresAt: '',
          ipWhitelist: '',
          ipBlacklist: '',
          allowedModels: '',
          allowedEndpoints: '',
          organizationId: '',
          projectId: '',
        });
        toast.success('API key created successfully', {
          description: 'Your new API key is ready to use',
        });
      } else {
        toast.error('Failed to create API key', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to create API key', {
        description: 'An unexpected error occurred',
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
        toast.success('API key revoked successfully', {
          description: 'The API key has been deactivated',
        });
      } else {
        toast.error('Failed to revoke API key', {
          description: 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to revoke API key', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const handleEditKey = (key: ApiKeyRow) => {
    setEditingKey(key);
    setFormData({
      name: key.name || '',
      provider: '', // Provider is not editable
      requestsPerMinute: key.requestsPerMinute,
      requestsPerDay: key.requestsPerDay,
      tokensPerDay: key.tokensPerDay,
      monthlySpendLimitUsd: key.monthlySpendLimitUsd || 0,
      expiresAt: '',
      ipWhitelist: '',
      ipBlacklist: '',
      allowedModels: '',
      allowedEndpoints: '',
      organizationId: '',
      projectId: '',
    });
    setShowEditForm(true);
  };

  const handleUpdateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/keys/${editingKey.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name || null,
          requestsPerMinute: formData.requestsPerMinute,
          requestsPerDay: formData.requestsPerDay,
          tokensPerDay: formData.tokensPerDay,
          monthlySpendLimitUsd: formData.monthlySpendLimitUsd || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowEditForm(false);
        setEditingKey(null);
        fetchKeys();
        toast.success('API key updated successfully', {
          description: 'The API key has been updated',
        });
      } else {
        toast.error('Failed to update API key', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to update API key', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast.success('Copied to clipboard', {
      description: 'API key copied successfully',
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditKey(row)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRevokeKey(row.id)}
              className="text-destructive border-destructive hover:bg-destructive hover:text-white"
            >
              Revoke
            </Button>
          </div>
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
                    onChange={(e) => {
                      const selectedProvider = providers.find(
                        (p) => p.id === e.target.value
                      );
                      if (selectedProvider) {
                        setFormData({
                          ...formData,
                          provider: e.target.value,
                          requestsPerMinute: selectedProvider.defaultRateLimits.requestsPerMinute,
                          requestsPerDay: selectedProvider.defaultRateLimits.requestsPerDay,
                          tokensPerDay: selectedProvider.defaultRateLimits.tokensPerDay,
                        });
                      } else {
                        setFormData({ ...formData, provider: e.target.value });
                      }
                    }}
                    required
                  >
                    {loadingProviders ? (
                      <option value="">Loading providers...</option>
                    ) : providers.length === 0 ? (
                      <option value="">No active providers available</option>
                    ) : (
                      <>
                        <option value="">Select a provider</option>
                        {providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name} ({provider.type})
                          </option>
                        ))}
                      </>
                    )}
                  </Select>
                </div>

                {providers.length > 0 && formData.provider && (
                  <AlertCard variant="info">
                    <p className="text-sm">
                      This API key will use the Claude API key configured in the selected provider.
                      The rate limits below can be customized for this specific key.
                    </p>
                  </AlertCard>
                )}

                {providers.length === 0 && !loadingProviders && (
                  <AlertCard variant="warning">
                    <p className="text-sm">
                      No providers available. Please create a provider first in the Provider Settings page.
                    </p>
                  </AlertCard>
                )}

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

                <div className="space-y-4">
                  <h4 className="font-medium">Spending Limit</h4>
                  <Input
                    label="Monthly Spend Limit (USD)"
                    type="number"
                    value={formData.monthlySpendLimitUsd}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlySpendLimitUsd: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="100"
                    helpText="Maximum amount in USD that can be spent per month. Leave at 0 for no limit."
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Security Settings (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Expiration Date</label>
                      <Input
                        type="date"
                        value={formData.expiresAt}
                        onChange={(e) =>
                          setFormData({ ...formData, expiresAt: e.target.value })
                        }
                        helpText="When should this key expire?"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">Allowed Models</label>
                      <Input
                        value={formData.allowedModels}
                        onChange={(e) =>
                          setFormData({ ...formData, allowedModels: e.target.value })
                        }
                        placeholder="claude-3-5-sonnet-20241022, claude-3-opus-20240229"
                        helpText="Comma-separated model IDs (leave empty for all)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium">IP Whitelist</label>
                      <textarea
                        className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        value={formData.ipWhitelist}
                        onChange={(e) =>
                          setFormData({ ...formData, ipWhitelist: e.target.value })
                        }
                        placeholder="192.168.1.1&#10;10.0.0.0/24"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        One IP/CIDR per line. If set, only these IPs can use this key.
                      </p>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">IP Blacklist</label>
                      <textarea
                        className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        value={formData.ipBlacklist}
                        onChange={(e) =>
                          setFormData({ ...formData, ipBlacklist: e.target.value })
                        }
                        placeholder="192.168.1.100&#10;10.0.0.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        One IP/CIDR per line. These IPs will be blocked from using this key.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Allowed Endpoints</label>
                    <Input
                      value={formData.allowedEndpoints}
                      onChange={(e) =>
                        setFormData({ ...formData, allowedEndpoints: e.target.value })
                      }
                      placeholder="/v1/messages, /v1/complete"
                      helpText="Comma-separated endpoint paths (leave empty for all)"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={submitting}
                  disabled={providers.length === 0 || !formData.provider}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Edit Form */}
        {showEditForm && editingKey && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Edit API Key - {editingKey.keyPrefix}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingKey(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateKey} className="space-y-6">
                <Input
                  label="Name (optional)"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="My API Key"
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

                <div className="space-y-4">
                  <h4 className="font-medium">Spending Limit</h4>
                  <Input
                    label="Monthly Spend Limit (USD)"
                    type="number"
                    value={formData.monthlySpendLimitUsd}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlySpendLimitUsd: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="100"
                    helpText="Maximum amount in USD that can be spent per month. Leave at 0 for no limit."
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={submitting}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Update API Key
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
                filters={[
                  {
                    key: 'isActive',
                    label: 'Status',
                    options: [
                      { label: 'Active', value: 'true' },
                      { label: 'Revoked', value: 'false' },
                    ],
                  },
                  {
                    key: 'provider',
                    label: 'Provider',
                    options: providers.map((p) => ({
                      label: p.name,
                      value: p.name,
                    })),
                  },
                ] as TableFilter[]}
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
