'use client';

import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage API keys and monitor usage across all users
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/keys"
            className="p-6 border border-border rounded-lg hover:border-accent transition space-y-2"
          >
            <h2 className="text-xl font-semibold">API Key Management</h2>
            <p className="text-muted-foreground">
              Create, view, update, and revoke API keys
            </p>
          </Link>

          <div className="p-6 border border-border rounded-lg opacity-50 cursor-not-allowed space-y-2">
            <h2 className="text-xl font-semibold">Global Analytics</h2>
            <p className="text-muted-foreground">
              View usage statistics across all API keys (Coming soon)
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Authentication is not yet implemented. In production, protect these routes with NextAuth.js
            or your preferred authentication solution.
          </p>
        </div>
      </div>
    </main>
  );
}
