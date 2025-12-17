'use client';

import { useState, useEffect } from 'react';
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
  SkeletonTable,
} from '@/components/ui';
import {
  Plus,
  Zap,
  Globe,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface Provider {
  id: string;
  name: string;
  type: 'official' | 'bedrock' | 'custom';
  endpoint: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  lastTestedAt: string | null;
  status: 'healthy' | 'unhealthy' | 'unknown';
  defaultRateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
    tokensPerDay: number;
  };
}

/**
 * Provider management page - allows admins to configure Claude API providers
 * and endpoints for the gateway.
 */
export default function ProviderSettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'official' as 'official' | 'bedrock' | 'custom',
    endpoint: '',
    apiKey: '',
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    tokensPerDay: 1000000,
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/providers');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch providers');
      }

      setProviders(data.providers);
    } catch (error) {
      toast.error('Failed to fetch providers', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const getDefaultEndpoint = (type: string) => {
    switch (type) {
      case 'official':
        return 'https://api.anthropic.com';
      case 'bedrock':
        return 'https://bedrock.us-east-1.amazonaws.com';
      default:
        return '';
    }
  };

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          endpoint: formData.endpoint || undefined,
          apiKey: formData.apiKey,
          defaultRateLimits: {
            requestsPerMinute: formData.requestsPerMinute,
            requestsPerDay: formData.requestsPerDay,
            tokensPerDay: formData.tokensPerDay,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create provider');
      }

      await fetchProviders();
      setShowCreateForm(false);
      setFormData({
        name: '',
        type: 'official',
        endpoint: '',
        apiKey: '',
        requestsPerMinute: 60,
        requestsPerDay: 1000,
        tokensPerDay: 1000000,
      });
      toast.success('Provider added successfully', {
        description: `${formData.name} is now available`,
      });
    } catch (error) {
      toast.error('Failed to add provider', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/providers/${editingProvider.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          endpoint: formData.endpoint || undefined,
          apiKey: formData.apiKey || undefined,
          defaultRateLimits: {
            requestsPerMinute: formData.requestsPerMinute,
            requestsPerDay: formData.requestsPerDay,
            tokensPerDay: formData.tokensPerDay,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update provider');
      }

      await fetchProviders();
      setEditingProvider(null);
      setFormData({
        name: '',
        type: 'official',
        endpoint: '',
        apiKey: '',
        requestsPerMinute: 60,
        requestsPerDay: 1000,
        tokensPerDay: 1000000,
      });
      toast.success('Provider updated successfully', {
        description: 'Changes have been saved',
      });
    } catch (error) {
      toast.error('Failed to update provider', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleProviderStatus = async (provider: Provider) => {
    try {
      const response = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !provider.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update provider status');
      }

      await fetchProviders();

      toast.success(
        provider.isActive ? 'Provider disabled' : 'Provider enabled',
        {
          description: `${provider.name} is now ${provider.isActive ? 'inactive' : 'active'}`,
        }
      );
    } catch (error) {
      toast.error('Failed to update provider status', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  const handleSetDefault = async (provider: Provider) => {
    try {
      const response = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isDefault: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to set default provider');
      }

      await fetchProviders();

      toast.success('Default provider updated', {
        description: `${provider.name} is now the default provider`,
      });
    } catch (error) {
      toast.error('Failed to set default provider', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  const handleTestConnection = async (provider: Provider) => {
    setTesting(provider.id);

    try {
      const response = await fetch(`/api/admin/providers/${provider.id}/test`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to test connection');
      }

      await fetchProviders();

      if (data.status === 'healthy') {
        toast.success('Connection successful', {
          description: `${provider.name} is responding correctly (${data.latency}ms)`,
        });
      } else {
        toast.error('Connection failed', {
          description: data.error || `${provider.name} is not responding`,
        });
      }
    } catch (error) {
      await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'unhealthy',
          lastTestedAt: new Date().toISOString(),
        }),
      });
      await fetchProviders();

      toast.error('Test failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setTesting(null);
    }
  };

  const handleDeleteProvider = async (provider: Provider) => {
    if (provider.isDefault) {
      toast.error('Cannot delete default provider', {
        description: 'Set another provider as default first',
      });
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${provider.name}? This action cannot be undone.`
      )
    )
      return;

    try {
      const response = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete provider');
      }

      await fetchProviders();
      toast.success('Provider deleted successfully', {
        description: `${provider.name} has been removed`,
      });
    } catch (error) {
      toast.error('Failed to delete provider', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  const handleEditProvider = (provider: Provider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      endpoint: provider.endpoint,
      apiKey: '',
      requestsPerMinute: provider.defaultRateLimits.requestsPerMinute,
      requestsPerDay: provider.defaultRateLimits.requestsPerDay,
      tokensPerDay: provider.defaultRateLimits.tokensPerDay,
    });
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingProvider(null);
    setShowCreateForm(false);
    setFormData({
      name: '',
      type: 'official',
      endpoint: '',
      apiKey: '',
      requestsPerMinute: 60,
      requestsPerDay: 1000,
      tokensPerDay: 1000000,
    });
  };

  const columns: Column<Provider>[] = [
    {
      key: 'name',
      header: 'Provider',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.name}</span>
            {row.isDefault && (
              <span className="px-2 py-0.5 text-xs bg-accent/20 text-accent rounded">
                Default
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            {row.endpoint}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs font-medium">
          <Shield className="h-3 w-3" />
          {row.type === 'official'
            ? 'Official'
            : row.type === 'bedrock'
            ? 'AWS Bedrock'
            : 'Custom'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            row.status === 'healthy'
              ? 'bg-success/20 text-success'
              : row.status === 'unhealthy'
              ? 'bg-destructive/20 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.status === 'healthy' ? (
            <>
              <CheckCircle className="h-3 w-3" />
              Healthy
            </>
          ) : row.status === 'unhealthy' ? (
            <>
              <XCircle className="h-3 w-3" />
              Unhealthy
            </>
          ) : (
            <>Unknown</>
          )}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Active',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            row.isActive
              ? 'bg-success/20 text-success'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.isActive ? 'Enabled' : 'Disabled'}
        </span>
      ),
    },
    {
      key: 'defaultRateLimits',
      header: 'Default Limits',
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          {row.defaultRateLimits.requestsPerMinute}/min •{' '}
          {row.defaultRateLimits.requestsPerDay}/day •{' '}
          {Number(row.defaultRateLimits.tokensPerDay).toLocaleString()} tokens
        </div>
      ),
    },
    {
      key: 'lastTestedAt',
      header: 'Last Tested',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {row.lastTestedAt
            ? new Date(row.lastTestedAt).toLocaleDateString()
            : 'Never'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTestConnection(row)}
            isLoading={testing === row.id}
            disabled={testing !== null}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditProvider(row)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          {!row.isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSetDefault(row)}
              className="text-accent"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleProviderStatus(row)}
            className={row.isActive ? 'text-destructive' : 'text-success'}
          >
            {row.isActive ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteProvider(row)}
            className="text-destructive hover:text-destructive"
            disabled={row.isDefault}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Provider Settings</h1>
            <p className="text-muted-foreground">
              Configure Claude API providers and endpoints for your gateway
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>


        {/* Create/Edit Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {editingProvider ? 'Edit Provider' : 'Add New Provider'}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={
                  editingProvider ? handleUpdateProvider : handleCreateProvider
                }
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Provider Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="My Claude Provider"
                    required
                  />

                  <Select
                    label="Provider Type"
                    value={formData.type}
                    onChange={(e) => {
                      const type = e.target.value as
                        | 'official'
                        | 'bedrock'
                        | 'custom';
                      setFormData({
                        ...formData,
                        type,
                        endpoint: getDefaultEndpoint(type),
                      });
                    }}
                  >
                    <option value="official">Claude Official API</option>
                    <option value="bedrock">AWS Bedrock</option>
                    <option value="custom">Custom Endpoint</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Input
                    label="API Endpoint URL"
                    value={formData.endpoint}
                    onChange={(e) =>
                      setFormData({ ...formData, endpoint: e.target.value })
                    }
                    placeholder="https://api.anthropic.com"
                  />
                  {formData.type !== 'custom' && (
                    <p className="text-xs text-muted-foreground">
                      Leave empty to use default endpoint
                    </p>
                  )}
                </div>

                <Input
                  label={editingProvider ? 'API Key (leave empty to keep current)' : 'API Key'}
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apiKey: e.target.value })
                  }
                  placeholder="sk-ant-..."
                  required={!editingProvider}
                />

                <div className="space-y-4">
                  <h4 className="font-medium">Default Rate Limits</h4>
                  <p className="text-sm text-muted-foreground">
                    These limits will be applied to new API keys using this provider
                  </p>
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
                  <Zap className="h-4 w-4 mr-2" />
                  {editingProvider ? 'Update Provider' : 'Add Provider'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Providers List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Configured Providers ({providers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <DataTable
                data={providers}
                columns={columns}
                searchable
                searchPlaceholder="Search by name or endpoint..."
                pageSize={10}
                emptyMessage="No providers configured. Click 'Add Provider' to configure your first provider."
                rowClassName={(row) => (!row.isActive ? 'opacity-60' : '')}
              />
            )}
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Providers</p>
                <p className="text-2xl font-bold">{providers.length}</p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Providers</p>
                <p className="text-2xl font-bold">
                  {providers.filter((p) => p.isActive).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy</p>
                <p className="text-2xl font-bold">
                  {providers.filter((p) => p.status === 'healthy').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unhealthy</p>
                <p className="text-2xl font-bold">
                  {providers.filter((p) => p.status === 'unhealthy').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
