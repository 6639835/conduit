'use client';

import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { FileText, CheckCircle, XCircle, AlertTriangle, Scale, Ban } from 'lucide-react';

export default function TermsPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-muted-foreground">
            Last updated: December 17, 2025
          </p>
        </div>

        {/* Introduction */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              <CardTitle>Agreement to Terms</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              These Terms of Service constitute a legally binding agreement between you and
              the operator of this Conduit API Gateway instance. By accessing or using the
              service, you agree to be bound by these Terms. If you disagree with any part
              of these terms, you may not access the service.
            </p>
          </CardContent>
        </Card>

        {/* Service Description */}
        <Card>
          <CardHeader>
            <CardTitle>Service Description</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Conduit is an API gateway service that provides:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Transparent proxying of requests to the Anthropic Claude API</li>
              <li>Usage analytics and monitoring</li>
              <li>Rate limiting and quota management</li>
              <li>Centralized API key management</li>
              <li>Request logging and audit trails</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              The service is provided as-is and we reserve the right to modify or discontinue
              features at any time.
            </p>
          </CardContent>
        </Card>

        {/* Acceptable Use */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-accent" />
              <CardTitle>Acceptable Use Policy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You agree to use the service only for lawful purposes and in accordance with
              these Terms. You agree not to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Use the service in any way that violates applicable laws or regulations</li>
              <li>Attempt to circumvent rate limits or usage quotas</li>
              <li>Reverse engineer, decompile, or disassemble the service</li>
              <li>Share your API keys with unauthorized parties</li>
              <li>Use the service to transmit malicious code or harmful content</li>
              <li>Attempt to gain unauthorized access to the service or related systems</li>
              <li>Use the service to harass, abuse, or harm others</li>
              <li>Violate Anthropic's Terms of Service or Usage Policy</li>
            </ul>
          </CardContent>
        </Card>

        {/* API Keys and Authentication */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys and Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Maintaining the confidentiality of your API keys</li>
              <li>All activities that occur under your API keys</li>
              <li>Immediately notifying the administrator of any unauthorized use</li>
              <li>Ensuring your API keys are stored securely and not exposed in public repositories</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We reserve the right to revoke API keys at any time for violation of these Terms
              or suspicious activity.
            </p>
          </CardContent>
        </Card>

        {/* Rate Limits and Quotas */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-accent" />
              <CardTitle>Rate Limits and Quotas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your API key is subject to rate limits and usage quotas as configured by your
              administrator. These limits may include:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Requests per minute</li>
              <li>Requests per day</li>
              <li>Tokens per day</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Requests that exceed these limits will be rejected. We reserve the right to
              modify limits at any time without notice.
            </p>
          </CardContent>
        </Card>

        {/* Data and Privacy */}
        <Card>
          <CardHeader>
            <CardTitle>Data and Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We collect and process data as described in our Privacy Policy. By using the
              service, you consent to such processing and warrant that all data provided by
              you is accurate.
            </p>
            <p className="text-muted-foreground">
              You retain all rights to the content of your API requests and responses. We
              only store metadata for analytics and monitoring purposes.
            </p>
          </CardContent>
        </Card>

        {/* Disclaimers */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-accent" />
              <CardTitle>Disclaimers</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY
              KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Warranties of merchantability or fitness for a particular purpose</li>
              <li>Warranties of uninterrupted or error-free service</li>
              <li>Warranties regarding the accuracy or reliability of results</li>
              <li>Warranties that the service will meet your requirements</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We do not guarantee the availability, performance, or functionality of the
              underlying Anthropic Claude API.
            </p>
          </CardContent>
        </Card>

        {/* Limitation of Liability */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-accent" />
              <CardTitle>Limitation of Liability</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
              LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR
              ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Your use or inability to use the service</li>
              <li>Any unauthorized access to or use of our servers</li>
              <li>Any interruption or cessation of transmission to or from the service</li>
              <li>Any bugs, viruses, or other harmful code</li>
              <li>Any errors or omissions in content or data</li>
            </ul>
          </CardContent>
        </Card>

        {/* Termination */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-accent" />
              <CardTitle>Termination</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We may terminate or suspend your access to the service immediately, without
              prior notice or liability, for any reason, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Breach of these Terms of Service</li>
              <li>Suspicious or fraudulent activity</li>
              <li>Violation of applicable laws or regulations</li>
              <li>Request by law enforcement or government agencies</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Upon termination, your right to use the service will immediately cease.
            </p>
          </CardContent>
        </Card>

        {/* Changes to Terms */}
        <Card>
          <CardHeader>
            <CardTitle>Changes to Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We reserve the right to modify or replace these Terms at any time. If a
              revision is material, we will make reasonable efforts to provide notice.
              What constitutes a material change will be determined at our sole discretion.
            </p>
            <p className="text-muted-foreground">
              By continuing to access or use the service after revisions become effective,
              you agree to be bound by the revised terms.
            </p>
          </CardContent>
        </Card>

        {/* Governing Law */}
        <Card>
          <CardHeader>
            <CardTitle>Governing Law</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              These Terms shall be governed and construed in accordance with the laws of
              the jurisdiction in which the service operator is located, without regard to
              its conflict of law provisions.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              If you have any questions about these Terms of Service, please contact your
              system administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
