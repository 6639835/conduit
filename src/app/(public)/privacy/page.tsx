'use client';

import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Shield, Database, Eye, Lock, UserCheck, FileText } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground">
            Last updated: December 17, 2025
          </p>
        </div>

        {/* Introduction */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              <CardTitle>Our Commitment to Privacy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              At Conduit, we take your privacy seriously. This Privacy Policy explains how
              we collect, use, disclose, and safeguard your information when you use our
              API gateway service. Please read this privacy policy carefully.
            </p>
          </CardContent>
        </Card>

        {/* Information We Collect */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-accent" />
              <CardTitle>Information We Collect</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2">API Usage Data</p>
                <p className="text-muted-foreground">
                  We collect information about your API usage, including request metadata,
                  token counts, model selections, timestamps, and response status codes.
                  This data is essential for providing usage analytics and enforcing rate limits.
                </p>
              </div>
              <div>
                <p className="font-medium mb-2">Authentication Information</p>
                <p className="text-muted-foreground">
                  We store hashed versions of API keys for authentication purposes. API keys
                  are never stored in plain text and are secured using industry-standard
                  cryptographic hashing algorithms.
                </p>
              </div>
              <div>
                <p className="font-medium mb-2">Log Data</p>
                <p className="text-muted-foreground">
                  We automatically collect log data including IP addresses, request headers,
                  and error messages for security monitoring, debugging, and service improvement.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How We Use Your Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-accent" />
              <CardTitle>How We Use Your Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>To provide and maintain our API gateway service</li>
              <li>To authenticate and authorize API requests</li>
              <li>To enforce rate limits and usage quotas</li>
              <li>To generate usage analytics and reports</li>
              <li>To monitor for security threats and abuse</li>
              <li>To improve our service and develop new features</li>
              <li>To comply with legal obligations</li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-accent" />
              <CardTitle>Data Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We implement appropriate technical and organizational security measures to
              protect your information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>All data transmissions are encrypted using HTTPS/TLS</li>
              <li>API keys are hashed using secure cryptographic algorithms</li>
              <li>Access to user data is restricted to authorized personnel only</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Secure database storage with encryption at rest</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              However, no method of transmission over the internet or electronic storage
              is 100% secure. While we strive to use commercially acceptable means to
              protect your information, we cannot guarantee its absolute security.
            </p>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              <CardTitle>Data Retention</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We retain your information for as long as necessary to provide our services
              and comply with legal obligations:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>API usage logs are retained for 90 days for analytics and debugging</li>
              <li>Authentication data is retained while your account is active</li>
              <li>Security logs may be retained longer for compliance purposes</li>
            </ul>
          </CardContent>
        </Card>

        {/* Third-Party Services */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-accent" />
              <CardTitle>Third-Party Services</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Conduit acts as a gateway to the Anthropic Claude API. Your API requests are
              forwarded to Anthropic for processing. Please review Anthropic's Privacy Policy
              to understand how they handle your data.
            </p>
            <p className="text-muted-foreground">
              We do not share your personal information with third parties except as necessary
              to provide our service or as required by law.
            </p>
          </CardContent>
        </Card>

        {/* Your Rights */}
        <Card>
          <CardHeader>
            <CardTitle>Your Rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Depending on your location, you may have certain rights regarding your personal
              information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>The right to access your personal information</li>
              <li>The right to correct inaccurate information</li>
              <li>The right to request deletion of your information</li>
              <li>The right to restrict or object to processing</li>
              <li>The right to data portability</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              To exercise these rights, please contact your system administrator.
            </p>
          </CardContent>
        </Card>

        {/* Changes to Privacy Policy */}
        <Card>
          <CardHeader>
            <CardTitle>Changes to This Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We may update our Privacy Policy from time to time. We will notify you of any
              changes by posting the new Privacy Policy on this page and updating the "Last
              updated" date at the top of this policy.
            </p>
            <p className="text-muted-foreground">
              You are advised to review this Privacy Policy periodically for any changes.
              Changes to this Privacy Policy are effective when they are posted on this page.
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
              If you have any questions about this Privacy Policy, please contact your
              system administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
