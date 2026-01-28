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
  AlertCard,
  SkeletonTable,
} from '@/components/ui';
import {
  Plus,
  FileText,
  Clock,
  Copy,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface KeyTemplate {
  id: string;
  name: string;
  description: string | null;
  providerId: string | null;
  providerName: string | null;
  providerSelectionStrategy: string;
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerDay: number;
  monthlySpendLimitUsd: number | null;
  expiresInDays: number | null;
  usageCount: number;
  createdAt: string;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export default function KeyTemplatesPage() {
  const [templates, setTemplates] = useState<KeyTemplate[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    providerId: '',
    providerSelectionStrategy: 'single' as 'single' | 'priority' | 'round-robin' | 'least-loaded' | 'cost-optimized',
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    tokensPerDay: 1000000,
    monthlySpendLimitUsd: 100,
    expiresInDays: '',
    ipWhitelist: '',
    ipBlacklist: '',
    allowedModels: '',
    allowedEndpoints: '',
    emailNotificationsEnabled: false,
    webhookUrl: '',
    slackWebhook: '',
    discordWebhook: '',
  });

  useEffect(() => {
    fetchTemplates();
    fetchProviders();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/key-templates');
      const data = await response.json();
      if (data.success && data.templates) {
        setTemplates(data.templates);
      }
    } catch {
      toast.error('Failed to fetch templates', {
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

        const defaultProvider = activeProviders.find((p: Provider) => p.isActive);
        if (defaultProvider) {
          setFormData((prev) => ({
            ...prev,
            providerId: defaultProvider.id,
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

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        providerId: formData.providerId,
        providerSelectionStrategy: formData.providerSelectionStrategy,
        requestsPerMinute: formData.requestsPerMinute,
        requestsPerDay: formData.requestsPerDay,
        tokensPerDay: formData.tokensPerDay,
        monthlySpendLimitUsd: formData.monthlySpendLimitUsd || undefined,
        expiresInDays: formData.expiresInDays ? parseInt(formData.expiresInDays) : undefined,
        ipWhitelist: formData.ipWhitelist ? formData.ipWhitelist.split('\n').filter(Boolean) : undefined,
        ipBlacklist: formData.ipBlacklist ? formData.ipBlacklist.split('\n').filter(Boolean) : undefined,
        allowedModels: formData.allowedModels ? formData.allowedModels.split(',').map(m => m.trim()).filter(Boolean) : undefined,
        allowedEndpoints: formData.allowedEndpoints ? formData.allowedEndpoints.split(',').map(e => e.trim()).filter(Boolean) : undefined,
        emailNotificationsEnabled: formData.emailNotificationsEnabled,
        webhookUrl: formData.webhookUrl || undefined,
        slackWebhook: formData.slackWebhook || undefined,
        discordWebhook: formData.discordWebhook || undefined,
      };

      const response = await fetch('/api/admin/key-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setShowCreateForm(false);
        fetchTemplates();
        setFormData({
          name: '',
          description: '',
          providerId: providers[0]?.id || '',
          providerSelectionStrategy: 'single',
          requestsPerMinute: 60,
          requestsPerDay: 1000,
          tokensPerDay: 1000000,
          monthlySpendLimitUsd: 100,
          expiresInDays: '',
          ipWhitelist: '',
          ipBlacklist: '',
          allowedModels: '',
          allowedEndpoints: '',
          emailNotificationsEnabled: false,
          webhookUrl: '',
          slackWebhook: '',
          discordWebhook: '',
        });
        toast.success('Template created successfully', {
          description: 'Your new key template is ready to use',
        });
      } else {
        toast.error('Failed to create template', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to create template', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<KeyTemplate>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{row.name}</div>
            {row.description && (
              <div className="text-xs text-muted-foreground">{row.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'providerName',
      header: 'Provider',
      sortable: true,
      render: (row) => row.providerName || <span className="text-muted-foreground">Multi-provider</span>,
    },
    {
      key: 'limits',
      header: 'Default Limits',
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          {row.requestsPerMinute}/min • {row.requestsPerDay}/day •{' '}
          {Number(row.tokensPerDay).toLocaleString()} tokens
        </div>
      ),
    },
    {
      key: 'usageCount',
      header: 'Keys Created',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1">
          <Copy className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-sm">{row.usageCount}</span>
        </div>
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
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">API Key Templates</h1>
            <p className="text-muted-foreground">
              Create reusable templates for standardized API key generation
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Info Alert */}
        {!showCreateForm && templates.length === 0 && !loading && (
          <AlertCard variant="info">
            <div className="space-y-2">
              <p className="font-medium">No templates yet</p>
              <p className="text-sm">
                Create templates to standardize API key creation with pre-configured quotas, security settings, and notification preferences.
              </p>
            </div>
          </AlertCard>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Create New Template</CardTitle>
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
              <form onSubmit={handleCreateTemplate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Template Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Production Keys"
                    required
                  />

                  <Select
                    label="Provider"
                    value={formData.providerId}
                    onChange={(e) => setFormData({ ...formData, providerId: e.target.value })}
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

                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-medium">Description (optional)</label>
                  <textarea
                    className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Template for production API keys with standard rate limits"
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Default Rate Limits</h4>
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
                  <h4 className="font-medium">Spending & Expiration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      helpText="Default monthly spend limit for keys"
                    />
                    <Input
                      label="Expires In (Days)"
                      type="number"
                      value={formData.expiresInDays}
                      onChange={(e) =>
                        setFormData({ ...formData, expiresInDays: e.target.value })
                      }
                      placeholder="90"
                      helpText="Leave empty for no expiration"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={submitting}
                  disabled={providers.length === 0 || !formData.providerId}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Templates List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saved Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <DataTable
                data={templates}
                columns={columns}
                searchable
                searchPlaceholder="Search templates..."
                pageSize={10}
                emptyMessage="No templates created yet. Click 'Create Template' to get started."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
