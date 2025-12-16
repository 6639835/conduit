import Link from 'next/link';
import { Zap, BarChart3, Shield, Clock, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: Zap,
      title: 'Transparent Proxy',
      description: 'Seamlessly proxy Claude API requests with zero configuration',
    },
    {
      icon: Shield,
      title: 'Rate Limiting',
      description: 'Enforce quotas and rate limits per API key',
    },
    {
      icon: BarChart3,
      title: 'Usage Analytics',
      description: 'Track requests, tokens, and costs in real-time',
    },
    {
      icon: Clock,
      title: 'Zero Auth Required',
      description: 'No end-user authentication needed for API access',
    },
  ];

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 py-24 sm:py-32">
          <div className="text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium">
              <Zap className="h-4 w-4" />
              Claude API Gateway
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              Conduit
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A transparent API gateway for Claude with built-in analytics,
              rate limiting, and usage tracking. Ship faster with zero configuration.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/usage"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition"
              >
                View Usage
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition"
              >
                Admin Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="p-6 rounded-2xl border border-border bg-background hover:shadow-lg transition-shadow"
              >
                <div className="rounded-lg bg-accent/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Getting Started */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="rounded-2xl border border-border bg-muted/30 p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Getting Started</h2>
              <p className="text-muted-foreground">
                Contact your administrator to receive an API key, then start
                making requests to the Claude API through Conduit.
              </p>
              <div className="pt-2">
                <Link
                  href="/admin/keys"
                  className="inline-flex items-center gap-2 text-accent hover:underline font-medium"
                >
                  Manage API Keys
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="bg-background rounded-lg border border-border p-6">
              <p className="text-sm text-muted-foreground mb-2">API Endpoint</p>
              <code className="block px-4 py-3 bg-muted rounded-lg font-mono text-sm overflow-x-auto">
                POST /api/claude/v1/messages
              </code>
              <p className="text-sm text-muted-foreground mt-4 mb-2">
                Authorization Header
              </p>
              <code className="block px-4 py-3 bg-muted rounded-lg font-mono text-sm overflow-x-auto">
                x-api-key: sk-cond_your-key-here
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span>Conduit API Gateway</span>
          </div>
          <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
