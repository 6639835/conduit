'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Input,
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
  Webhook,
  Clock,
  CheckCircle,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface WebhookConfig {
  id: string;
  name: string;
  description: string | null;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  { value: 'quota.warning', label: 'Quota Warning', description: 'Triggered at 80% and 90% usage' },
  { value: 'quota.exceeded', label: 'Quota Exceeded', description: 'When quota limit is reached' },
  { value: 'key.expired', label: 'Key Expired', description: 'When an API key expires' },
  { value: 'key.expiring_soon', label: 'Key Expiring Soon', description: 'Key expires within 7 days' },
  { value: 'key.created', label: 'Key Created', description: 'New API key created' },
  { value: 'key.revoked', label: 'Key Revoked', description: 'API key revoked' },
  { value: 'key.rotated', label: 'Key Rotated', description: 'API key rotated' },
  { value: 'spend.limit_reached', label: 'Spend Limit Reached', description: 'Monthly spend limit reached' },
  { value: 'error.rate_spike', label: 'Error Rate Spike', description: 'Unusual increase in errors' },
  { value: 'provider.unhealthy', label: 'Provider Unhealthy', description: 'Provider health check failed' },
  { value: 'provider.restored', label: 'Provider Restored', description: 'Provider is healthy again' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    events: [] as string[],
    secret: '',
  });

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch('/api/admin/webhooks');
      const data = await response.json();
      if (data.success && data.webhooks) {
        setWebhooks(data.webhooks);
      }
    } catch {
      toast.error('Failed to fetch webhooks', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setShowCreateForm(false);
        fetchWebhooks();
        setFormData({
          name: '',
          description: '',
          url: '',
          events: [],
          secret: '',
        });
        toast.success('Webhook created successfully', {
          description: 'Your webhook is ready to receive events',
        });
      } else {
        toast.error('Failed to create webhook', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to create webhook', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setTestingWebhook(id);
    try {
      const response = await fetch(`/api/admin/webhooks/${id}/test`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Webhook test successful', {
          description: 'Test payload delivered successfully',
        });
      } else {
        toast.error('Webhook test failed', {
          description: data.error || 'Failed to deliver test payload',
        });
      }
    } catch {
      toast.error('Webhook test failed', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  const toggleEvent = (event: string) => {
    const newEvents = formData.events.includes(event)
      ? formData.events.filter(e => e !== event)
      : [...formData.events, event];
    setFormData({ ...formData, events: newEvents });
  };

  const columns: Column<WebhookConfig>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-muted-foreground" />
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
      key: 'url',
      header: 'Endpoint',
      render: (row) => (
        <code className="text-xs bg-muted px-2 py-1 rounded">
          {row.url.length > 40 ? row.url.substring(0, 40) + '...' : row.url}
        </code>
      ),
    },
    {
      key: 'events',
      header: 'Events',
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          {row.events.length} event{row.events.length !== 1 ? 's' : ''}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        if (!row.lastTriggeredAt) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
              <Clock className="h-3 w-3" />
              Never triggered
            </span>
          );
        }

        const hasRecentFailures = row.failureCount > 0 && row.lastFailureAt;
        const isHealthy = !hasRecentFailures || (row.lastSuccessAt && row.lastSuccessAt > (row.lastFailureAt || ''));

        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
              isHealthy
                ? 'bg-success/20 text-success'
                : 'bg-destructive/20 text-destructive'
            }`}
          >
            {isHealthy ? (
              <>
                <CheckCircle className="h-3 w-3" />
                Healthy
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" />
                {row.failureCount} failures
              </>
            )}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTestWebhook(row.id)}
            disabled={testingWebhook === row.id}
            isLoading={testingWebhook === row.id}
          >
            <Send className="h-4 w-4" />
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
            <h1 className="text-3xl font-bold">Webhook Configuration</h1>
            <p className="text-muted-foreground">
              Configure webhooks to receive real-time event notifications
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Webhook
          </Button>
        </div>

        {/* Info Alert */}
        {!showCreateForm && webhooks.length === 0 && !loading && (
          <AlertCard variant="info">
            <div className="space-y-2">
              <p className="font-medium">No webhooks configured</p>
              <p className="text-sm">
                Create webhooks to receive real-time notifications for quota warnings, key expirations, error spikes, and more.
              </p>
            </div>
          </AlertCard>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Create New Webhook</CardTitle>
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
              <form onSubmit={handleCreateWebhook} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Webhook Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Production Alerts"
                    required
                  />

                  <Input
                    label="Endpoint URL"
                    type="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="https://your-app.com/webhooks/conduit"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Description (optional)</label>
                  <textarea
                    className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Receives notifications for production environment"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Select Events</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AVAILABLE_EVENTS.map((event) => (
                      <label
                        key={event.value}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event.value)}
                          onChange={() => toggleEvent(event.value)}
                          className="h-4 w-4 mt-0.5 rounded border-border text-accent focus:ring-2 focus:ring-accent"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{event.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {event.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {formData.events.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Select at least one event to receive notifications
                    </p>
                  )}
                </div>

                <Input
                  label="Webhook Secret (optional)"
                  type="password"
                  value={formData.secret}
                  onChange={(e) =>
                    setFormData({ ...formData, secret: e.target.value })
                  }
                  placeholder="Leave empty to auto-generate"
                  helpText="Used to sign webhook payloads for verification"
                />

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={submitting}
                  disabled={formData.events.length === 0}
                >
                  <Webhook className="h-4 w-4 mr-2" />
                  Create Webhook
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Webhooks List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <DataTable
                data={webhooks}
                columns={columns}
                searchable
                searchPlaceholder="Search webhooks..."
                pageSize={10}
                emptyMessage="No webhooks configured yet. Click 'Create Webhook' to get started."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
