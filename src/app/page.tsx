import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            Conduit
          </h1>
          <p className="text-xl text-muted-foreground">
            Transparent Claude API Gateway with Analytics
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
          <Link
            href="/usage"
            className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition"
          >
            View Usage
          </Link>
          <Link
            href="/admin"
            className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition"
          >
            Admin Dashboard
          </Link>
        </div>

        <div className="pt-12 space-y-6 text-left">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Features</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Transparent proxy for Claude API requests</li>
              <li>• Rate limiting and quota enforcement</li>
              <li>• Usage analytics and cost tracking</li>
              <li>• No end-user authentication required</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Getting Started</h2>
            <p className="text-muted-foreground">
              Contact your administrator to receive an API key. Use your key to make requests to{' '}
              <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                /api/claude/*
              </code>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
