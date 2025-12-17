'use client';

import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Book, Code, Key, BarChart3, Shield, Zap } from 'lucide-react';

export default function DocumentationPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Documentation</h1>
          <p className="text-muted-foreground">
            Everything you need to know about using Conduit API Gateway
          </p>
        </div>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Book className="h-5 w-5 text-accent" />
              <CardTitle>Getting Started</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Conduit is a transparent Claude API gateway that provides usage analytics,
              rate limiting, and centralized API key management. Get started in minutes
              by following these steps.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Contact your administrator to obtain an API key</li>
              <li>Replace your existing Anthropic API endpoint with the Conduit endpoint</li>
              <li>Use your Conduit API key in place of your Anthropic API key</li>
              <li>Monitor your usage through the Usage Dashboard</li>
            </ol>
          </CardContent>
        </Card>

        {/* API Usage */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-accent" />
              <CardTitle>API Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Using Conduit is identical to using the Claude API directly. Simply update
              your API endpoint and key.
            </p>
            <div className="bg-muted p-4 rounded-md font-mono text-sm">
              <div className="space-y-2">
                <p className="text-muted-foreground">// Example using the Anthropic SDK</p>
                <p>const client = new Anthropic(&#123;</p>
                <p className="pl-4">apiKey: 'sk-cond_your-api-key',</p>
                <p className="pl-4">baseURL: 'https://your-conduit-instance.com'</p>
                <p>&#125;);</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-accent" />
              <CardTitle>API Keys</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              All Conduit API keys start with the prefix <code className="bg-muted px-2 py-1 rounded">sk-cond_</code>.
              Keys can be configured with custom rate limits and usage quotas by your administrator.
            </p>
            <div className="space-y-2">
              <p className="font-medium">Key Features:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Custom rate limits (requests per minute/day)</li>
                <li>Token quotas (tokens per day)</li>
                <li>Provider assignment (multiple Anthropic API keys)</li>
                <li>Usage tracking and analytics</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Usage Tracking */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              <CardTitle>Usage Tracking</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Monitor your API usage in real-time through the Usage Dashboard. Track requests,
              tokens, costs, and quota consumption.
            </p>
            <div className="space-y-2">
              <p className="font-medium">Available Metrics:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Total requests and success rate</li>
                <li>Input and output token usage</li>
                <li>Cost breakdown by model</li>
                <li>Remaining quota limits</li>
                <li>Model-specific usage statistics</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              <CardTitle>Rate Limits</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Conduit enforces rate limits to ensure fair usage and prevent abuse. When you
              exceed your limits, requests will be rejected with a 429 status code.
            </p>
            <div className="space-y-2">
              <p className="font-medium">Limit Types:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Requests per minute</li>
                <li>Requests per day</li>
                <li>Tokens per day</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              <CardTitle>Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your API keys and data are secure with Conduit. We follow industry best
              practices to protect your information.
            </p>
            <div className="space-y-2">
              <p className="font-medium">Security Practices:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>API keys are hashed and never stored in plain text</li>
                <li>All requests are logged for audit purposes</li>
                <li>HTTPS encryption for all API communications</li>
                <li>Role-based access control for administrators</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
