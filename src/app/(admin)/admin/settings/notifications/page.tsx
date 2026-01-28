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
  AlertCard,
} from '@/components/ui';
import {
  Bell,
  Mail,
  Send,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface NotificationSettings {
  emailNotificationsEnabled: boolean;
  notificationEmail: string | null;
  slackWebhookUrl: string | null;
  discordWebhookUrl: string | null;
  notificationPreferences: {
    quotaWarnings: boolean;
    keyExpirations: boolean;
    errorSpikes: boolean;
    providerHealth: boolean;
    spendLimits: boolean;
  };
}

export default function NotificationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotificationsEnabled: false,
    notificationEmail: null,
    slackWebhookUrl: null,
    discordWebhookUrl: null,
    notificationPreferences: {
      quotaWarnings: true,
      keyExpirations: true,
      errorSpikes: true,
      providerHealth: true,
      spendLimits: true,
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/notifications');
      const data = await response.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch {
      toast.error('Failed to fetch notification settings', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Settings saved successfully', {
          description: 'Your notification preferences have been updated',
        });
      } else {
        toast.error('Failed to save settings', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to save settings', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestNotification = async (channel: 'email' | 'slack' | 'discord') => {
    setTesting(channel);

    try {
      const recipient = channel === 'email'
        ? settings.notificationEmail
        : channel === 'slack'
          ? settings.slackWebhookUrl
          : settings.discordWebhookUrl;

      if (!recipient) {
        toast.error('No recipient configured', {
          description: `Please configure ${channel} settings first`,
        });
        setTesting(null);
        return;
      }

      const response = await fetch('/api/admin/settings/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, recipient }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Test notification sent', {
          description: data.message || `Test ${channel} notification delivered successfully`,
        });
      } else {
        toast.error('Test notification failed', {
          description: data.error || 'Failed to send test notification',
        });
      }
    } catch {
      toast.error('Test notification failed', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="h-8 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notification Settings
          </h1>
          <p className="text-muted-foreground">
            Configure how you want to receive alerts and notifications
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Email Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="emailEnabled"
                  checked={settings.emailNotificationsEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      emailNotificationsEnabled: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent"
                />
                <label htmlFor="emailEnabled" className="text-sm font-medium cursor-pointer">
                  Enable email notifications
                </label>
              </div>

              {settings.emailNotificationsEnabled && (
                <>
                  <Input
                    label="Notification Email"
                    type="email"
                    value={settings.notificationEmail || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notificationEmail: e.target.value || null,
                      })
                    }
                    placeholder="notifications@example.com"
                    helpText="Email address to receive notifications"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestNotification('email')}
                    isLoading={testing === 'email'}
                    disabled={!settings.notificationEmail}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Test Email
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Slack Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Slack Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AlertCard variant="info">
                <p className="text-sm">
                  Create an Incoming Webhook in your Slack workspace and paste the URL below.
                  <a
                    href="https://api.slack.com/messaging/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline ml-1"
                  >
                    Learn more →
                  </a>
                </p>
              </AlertCard>

              <Input
                label="Slack Webhook URL"
                type="url"
                value={settings.slackWebhookUrl || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    slackWebhookUrl: e.target.value || null,
                  })
                }
                placeholder="https://hooks.slack.com/services/..."
                helpText="Slack incoming webhook URL"
              />

              {settings.slackWebhookUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestNotification('slack')}
                  isLoading={testing === 'slack'}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Test Slack Integration
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Discord Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Discord Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AlertCard variant="info">
                <p className="text-sm">
                  Create a webhook in your Discord channel settings and paste the URL below.
                  <a
                    href="https://support.discord.com/hc/en-us/articles/228383668"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline ml-1"
                  >
                    Learn more →
                  </a>
                </p>
              </AlertCard>

              <Input
                label="Discord Webhook URL"
                type="url"
                value={settings.discordWebhookUrl || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    discordWebhookUrl: e.target.value || null,
                  })
                }
                placeholder="https://discord.com/api/webhooks/..."
                helpText="Discord webhook URL"
              />

              {settings.discordWebhookUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestNotification('discord')}
                  isLoading={testing === 'discord'}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Test Discord Integration
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Choose which events trigger notifications
              </p>

              {[
                { key: 'quotaWarnings', label: 'Quota Warnings', description: 'Get notified at 80% and 90% quota usage' },
                { key: 'keyExpirations', label: 'Key Expirations', description: 'Alerts when API keys expire or will expire soon' },
                { key: 'errorSpikes', label: 'Error Rate Spikes', description: 'Unusual increase in error rates' },
                { key: 'providerHealth', label: 'Provider Health', description: 'Provider outages and health changes' },
                { key: 'spendLimits', label: 'Spend Limits', description: 'Monthly spending limit warnings' },
              ].map(({ key, label, description }) => (
                <label
                  key={key}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={settings.notificationPreferences[key as keyof typeof settings.notificationPreferences]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notificationPreferences: {
                          ...settings.notificationPreferences,
                          [key]: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 mt-0.5 rounded border-border text-accent focus:ring-2 focus:ring-accent"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {description}
                    </div>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={submitting}
              className="min-w-[200px]"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
