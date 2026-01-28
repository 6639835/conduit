'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Select,
  AlertCard,
  Input,
} from '@/components/ui';
import {
  Shield,
  Download,
  FileText,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Database,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface ComplianceReport {
  organizationId: string;
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  retentionPolicy: {
    enabled: boolean;
    retentionDays: number;
    applyTo: string[];
  } | null;
  dataInventory: {
    apiKeys: number;
    logs: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
  };
  complianceIssues: string[];
  recommendations: string[];
}

export default function CompliancePage() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const handleGenerateReport = async () => {
    if (!organizationId) {
      toast.error('Please enter an organization ID');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/compliance/report?organizationId=${organizationId}`
      );

      if (res.ok) {
        const data = await res.json();
        setReport(data.data);
        toast.success('Compliance report generated');
      } else {
        const error = await res.json();
        toast.error('Failed to generate report', {
          description: error.error,
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    if (!organizationId) {
      toast.error('Please enter an organization ID');
      return;
    }

    setExporting(true);
    try {
      const res = await fetch('/api/admin/compliance/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          format: exportFormat,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Download as file
        const blob = new Blob([JSON.stringify(data.data, null, 2)], {
          type: exportFormat === 'json' ? 'application/json' : 'text/csv',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance-export-${organizationId}.${exportFormat}`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success('Data exported successfully', {
          description: `${data.recordCount.apiKeys} API keys, ${data.recordCount.logs} logs`,
        });
      } else {
        const error = await res.json();
        toast.error('Failed to export data', {
          description: error.error,
        });
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Compliance & Data Retention
            </h1>
            <p className="text-muted-foreground">
              GDPR/CCPA compliance, data retention policies, and data export
            </p>
          </div>
        </div>

        {/* Organization Input */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Organization ID"
                  value={organizationId}
                  onChange={e => setOrganizationId(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerateReport} disabled={loading || !organizationId}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Status */}
        {report && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">GDPR Compliance</p>
                      <p className="text-2xl font-bold">
                        {report.gdprCompliant ? 'Compliant' : 'Not Compliant'}
                      </p>
                    </div>
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        report.gdprCompliant ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {report.gdprCompliant ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">CCPA Compliance</p>
                      <p className="text-2xl font-bold">
                        {report.ccpaCompliant ? 'Compliant' : 'Not Compliant'}
                      </p>
                    </div>
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        report.ccpaCompliant ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {report.ccpaCompliant ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Retention Policy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Data Retention Policy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.retentionPolicy ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-900">Policy Active</p>
                          <p className="text-sm text-green-700">
                            Data older than {report.retentionPolicy.retentionDays} days is
                            automatically deleted
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">
                          {report.retentionPolicy.retentionDays}
                        </p>
                        <p className="text-sm text-muted-foreground">Days</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">
                          {report.retentionPolicy.applyTo.length}
                        </p>
                        <p className="text-sm text-muted-foreground">Data Types</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">Daily</p>
                        <p className="text-sm text-muted-foreground">Enforcement</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Applies to:</p>
                      <div className="flex flex-wrap gap-2">
                        {report.retentionPolicy.applyTo.map(type => (
                          <span
                            key={type}
                            className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <AlertCard variant="warning">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      <span>
                        No data retention policy configured. Data is retained indefinitely.
                      </span>
                    </div>
                  </AlertCard>
                )}
              </CardContent>
            </Card>

            {/* Data Inventory */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Inventory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">{report.dataInventory.apiKeys}</p>
                    <p className="text-sm text-muted-foreground mt-1">API Keys</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">
                      {report.dataInventory.logs.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Log Records</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">-</p>
                    <p className="text-sm text-muted-foreground mt-1">Oldest Record</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">-</p>
                    <p className="text-sm text-muted-foreground mt-1">Newest Record</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compliance Issues */}
            {report.complianceIssues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Compliance Issues ({report.complianceIssues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.complianceIssues.map((issue, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Recommendations ({report.recommendations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle>GDPR/CCPA Data Export</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export all organization data for compliance purposes (GDPR Right to Access,
                CCPA Right to Know)
              </p>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Export Format</label>
                  <Select
                    value={exportFormat}
                    onChange={e => setExportFormat(e.target.value as 'json' | 'csv')}
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </Select>
                </div>

                <div className="pt-7">
                  <Button onClick={handleExportData} disabled={exporting || !organizationId}>
                    <Download className={`h-4 w-4 mr-2 ${exporting ? 'animate-bounce' : ''}`} />
                    Export Data
                  </Button>
                </div>
              </div>

              <AlertCard variant="info">
                <p className="text-sm">
                  Exported data includes: API keys, logs (last 10,000), analytics data.
                  Sensitive information (PII) is automatically redacted.
                </p>
              </AlertCard>
            </div>
          </CardContent>
        </Card>

        {/* Right to be Forgotten */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Right to be Forgotten (GDPR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertCard variant="error">
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Permanently delete organization data
                </p>
                <p className="text-sm">
                  This action is irreversible. All API keys, logs, and analytics data for
                  this organization will be permanently deleted.
                </p>
                <p className="text-sm">
                  To delete organization data, contact your system administrator or use
                  the Admin API with proper authorization.
                </p>
              </div>
            </AlertCard>
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle>About Compliance Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-1">GDPR Compliance</h4>
                <p className="text-muted-foreground">
                  General Data Protection Regulation (EU). Requires data protection, right
                  to access, right to be forgotten, and data portability.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-1">CCPA Compliance</h4>
                <p className="text-muted-foreground">
                  California Consumer Privacy Act (US). Requires transparency about data
                  collection, right to know, right to delete, and opt-out of data sales.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-1">Data Retention</h4>
                <p className="text-muted-foreground">
                  Automated deletion of data older than the configured retention period.
                  Runs daily to ensure compliance with retention policies.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-1">PII Redaction</h4>
                <p className="text-muted-foreground">
                  Personally Identifiable Information is automatically redacted from
                  exports, including emails, phone numbers, IP addresses, and tokens.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
