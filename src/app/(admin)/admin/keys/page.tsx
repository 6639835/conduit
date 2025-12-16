'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { ListApiKeysResponse, CreateApiKeyResponse } from '@/types';

export default function AdminKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    provider: 'official',
    targetApiKey: '',
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    tokensPerDay: 1000000,
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/admin/keys');
      const data: ListApiKeysResponse = await response.json();
      if (data.success && data.apiKeys) {
        setKeys(data.apiKeys);
      }
    } catch (error) {
      console.error('Failed to fetch keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data: CreateApiKeyResponse = await response.json();

      if (data.success && data.apiKey) {
        setCreatedKey(data.apiKey.fullKey);
        setShowCreateForm(false);
        fetchKeys();
        setFormData({
          name: '',
          provider: 'official',
          targetApiKey: '',
          requestsPerMinute: 60,
          requestsPerDay: 1000,
          tokensPerDay: 1000000,
        });
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to create API key');
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    try {
      const response = await fetch(`/api/admin/keys/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchKeys();
      } else {
        alert('Failed to revoke key');
      }
    } catch (error) {
      alert('Failed to revoke key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold">API Key Management</h1>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition"
          >
            Create New Key
          </button>
        </div>

        {/* Created Key Display (shown once after creation) */}
        {createdKey && (
          <div className="p-6 border-2 border-accent rounded-lg space-y-3 bg-accent/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">API Key Created Successfully!</h2>
              <button
                onClick={() => setCreatedKey(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Copy this key now - it will only be shown once:
            </p>
            <div className="flex gap-2">
              <code className="flex-1 p-3 bg-background border border-border rounded font-mono text-sm">
                {createdKey}
              </code>
              <button
                onClick={() => copyToClipboard(createdKey)}
                className="px-4 py-2 border border-border rounded hover:bg-muted transition"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="p-6 border border-border rounded-lg space-y-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create New API Key</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name (optional)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My API Key"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Provider</label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                >
                  <option value="official">Claude Official API</option>
                  <option value="bedrock">AWS Bedrock</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Target Claude API Key *</label>
                <input
                  type="password"
                  value={formData.targetApiKey}
                  onChange={(e) => setFormData({ ...formData, targetApiKey: e.target.value })}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Requests/Min</label>
                  <input
                    type="number"
                    value={formData.requestsPerMinute}
                    onChange={(e) => setFormData({ ...formData, requestsPerMinute: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Requests/Day</label>
                  <input
                    type="number"
                    value={formData.requestsPerDay}
                    onChange={(e) => setFormData({ ...formData, requestsPerDay: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tokens/Day</label>
                  <input
                    type="number"
                    value={formData.tokensPerDay}
                    onChange={(e) => setFormData({ ...formData, tokensPerDay: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition"
              >
                Create API Key
              </button>
            </form>
          </div>
        )}

        {/* Keys List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Existing API Keys</h2>

          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : keys.length === 0 ? (
            <p className="text-muted-foreground">No API keys created yet</p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="p-4 border border-border rounded-lg flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <code className="font-mono text-sm">{key.keyPrefix}...</code>
                      {key.name && <span className="text-sm font-medium">{key.name}</span>}
                      <span className={`text-xs px-2 py-1 rounded ${key.isActive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                        {key.isActive ? 'Active' : 'Revoked'}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-muted">
                        {key.provider}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(key.createdAt).toLocaleDateString()} •
                      Limits: {key.requestsPerMinute}/min, {key.requestsPerDay}/day, {Number(key.tokensPerDay).toLocaleString()} tokens/day
                    </p>
                  </div>

                  {key.isActive && (
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="px-3 py-1 text-sm border border-destructive text-destructive rounded hover:bg-destructive hover:text-white transition"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
