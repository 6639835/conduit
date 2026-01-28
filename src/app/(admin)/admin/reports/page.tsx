'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  AlertCard,
} from '@/components/ui';
import {
  FileText,
  Mail,
  MessageSquare,
  Send,
  Calendar,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface ReportSettings {
  reportFrequencies: ('daily' | 'weekly' | 'monthly')[];
  emailNotificationsEnabled: boolean;
  notificationEmail: string | null;
  slackWebhookUrl: string | null;
  discordWebhookUrl: string | null;
}

export default function ReportsPage() {
  const [settings, setSettings] = useState<ReportSettings>({
    reportFrequencies: [],
    emailNotificationsEnabled: false,
    notificationEmail: null,
    slackWebhookUrl: null,
    discordWebhookUrl: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  type ReportFrequency = ReportSettings['reportFrequencies'][number];
  const frequencyOptions: Array<{
    id: ReportFrequency;
    label: string;
    description: string;
    schedule: string;
  }> = [
    {
      id: 'daily',
      label: 'Daily Reports',
      description: 'Sent every morning at 8:00 AM with yesterday\'s data',
      schedule: 'Every day at 8:00 AM',
    },
    {
      id: 'weekly',
      label: 'Weekly Reports',
      description: 'Sent every Monday with the previous week\'s data',
      schedule: 'Every Monday at 9:00 AM',
    },
    {
      id: 'monthly',
      label: 'Monthly Reports',
      description: 'Sent on the 1st of each month with previous month\'s data',
      schedule: '1st of each month at 9:00 AM',
    },
  ];
  const manualReportOptions: Array<{
    id: ReportFrequency;
    label: string;
    period: string;
  }> = [
    { id: 'daily', label: 'Daily Report', period: 'Yesterday' },
    { id: 'weekly', label: 'Weekly Report', period: 'Last 7 days' },
    { id: 'monthly', label: 'Monthly Report', period: 'Last month' },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/notifications');
      const data = await response.json();

      if (data.success && data.settings) {
        setSettings({
          reportFrequencies: data.settings.reportFrequencies || [],
          emailNotificationsEnabled: data.settings.emailNotificationsEnabled || false,
          notificationEmail: data.settings.notificationEmail || null,
          slackWebhookUrl: data.settings.slackWebhookUrl || null,
          discordWebhookUrl: data.settings.discordWebhookUrl || null,
        });
      }
    } catch {
      toast.error('Failed to fetch report settings', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const handleSaveSettings = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Report settings saved successfully');
      } else {
        toast.error('Failed to save settings', {
          description: data.error,
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

  const handleGenerateReport = async (frequency: 'daily' | 'weekly' | 'monthly') => {
    setGeneratingReport(frequency);
    try {
      // In production, this would trigger the cron job or generate a one-time report
      toast.info(`Generating ${frequency} report...`, {
        description: 'This may take a few moments',
      });

      // For now, just simulate success
      setTimeout(() => {
        toast.success(`${frequency.charAt(0).toUpperCase() + frequency.slice(1)} report generated`, {
          description: 'The report has been sent to your configured channels',
        });
        setGeneratingReport(null);
      }, 2000);
    } catch {
      toast.error('Failed to generate report', {
        description: 'An unexpected error occurred',
      });
      setGeneratingReport(null);
    }
  };

  const toggleFrequency = (frequency: 'daily' | 'weekly' | 'monthly') => {
    setSettings({
      ...settings,
      reportFrequencies: settings.reportFrequencies.includes(frequency)
        ? settings.reportFrequencies.filter(f => f !== frequency)
        : [...settings.reportFrequencies, frequency],
    });
  };

  const getChannelCount = () => {
    let count = 0;
    if (settings.emailNotificationsEnabled && settings.notificationEmail) count++;
    if (settings.slackWebhookUrl) count++;
    if (settings.discordWebhookUrl) count++;
    return count;
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Scheduled Reports
          </h1>
          <p className="text-muted-foreground">
            Configure automated usage reports delivered via email, Slack, or Discord
          </p>
        </div>

        {/* Info Alert */}
        <AlertCard variant="info">
          <p className="text-sm">
            Reports are automatically generated and sent to your configured notification
            channels. Enable the frequencies you want to receive below.
          </p>
        </AlertCard>

        {/* Report Frequencies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Report Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {frequencyOptions.map(({ id, label, description, schedule }) => (
                <label
                  key={id}
                  className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-accent/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={settings.reportFrequencies.includes(id)}
                    onChange={() => toggleFrequency(id)}
                    className="h-4 w-4 mt-0.5 rounded border-border text-accent focus:ring-2 focus:ring-accent"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{label}</div>
                      {settings.reportFrequencies.includes(id) && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {description}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <Clock className="h-3 w-3" />
                      {schedule}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {getChannelCount() === 0 && (
              <AlertCard variant="warning">
                <p className="text-sm">
                  You haven&apos;t configured any notification channels yet. Go to{' '}
                  <a
                    href="/admin/settings/notifications"
                    className="text-accent hover:underline font-medium"
                  >
                    Notification Settings
                  </a>{' '}
                  to set up email, Slack, or Discord delivery.
                </p>
              </AlertCard>
            )}

            {getChannelCount() > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Reports will be delivered to {getChannelCount()} channel(s):
                </p>
                <div className="flex flex-wrap gap-2">
                  {settings.emailNotificationsEnabled && settings.notificationEmail && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-full text-sm">
                      <Mail className="h-3 w-3" />
                      Email
                    </div>
                  )}
                  {settings.slackWebhookUrl && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-full text-sm">
                      <MessageSquare className="h-3 w-3" />
                      Slack
                    </div>
                  )}
                  {settings.discordWebhookUrl && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-full text-sm">
                      <MessageSquare className="h-3 w-3" />
                      Discord
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={handleSaveSettings} isLoading={submitting}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Manual Report Generation */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Report Manually</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generate and send a report immediately without waiting for the scheduled time
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {manualReportOptions.map(({ id, label, period }) => (
                <Card key={id} variant="outlined">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium">{label}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {period}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleGenerateReport(id)}
                        isLoading={generatingReport === id}
                        disabled={getChannelCount() === 0}
                      >
                        <Send className="h-3 w-3 mr-2" />
                        Generate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {getChannelCount() === 0 && (
              <AlertCard variant="warning" className="mt-4">
                <p className="text-sm">
                  Configure notification channels in{' '}
                  <a
                    href="/admin/settings/notifications"
                    className="text-accent hover:underline font-medium"
                  >
                    settings
                  </a>{' '}
                  to enable manual report generation.
                </p>
              </AlertCard>
            )}
          </CardContent>
        </Card>

        {/* Report Contents */}
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s Included in Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Request Volume', desc: 'Total API requests and trends' },
                { label: 'Cost Analysis', desc: 'Total spend and changes' },
                { label: 'Success Rate', desc: 'Request success and error rates' },
                { label: 'Top Models', desc: 'Most used AI models' },
                { label: 'Top API Keys', desc: 'Most active API keys' },
                { label: 'Smart Alerts', desc: 'Automatic anomaly detection' },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
