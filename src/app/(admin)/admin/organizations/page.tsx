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
  DataTable,
  type Column,
  SkeletonTable,
} from '@/components/ui';
import {
  Plus,
  Building2,
  Users,
  Key,
  Check,
  X,
  Edit,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  maxApiKeys: number;
  maxUsers: number;
  isActive: boolean;
  createdAt: string;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'free',
    maxApiKeys: 10,
    maxUsers: 5,
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/admin/organizations');
      const data = await response.json();
      if (data.organizations) {
        setOrganizations(data.organizations);
      }
    } catch {
      toast.error('Failed to fetch organizations', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setShowCreateForm(false);
        fetchOrganizations();
        setFormData({
          name: '',
          slug: '',
          plan: 'free',
          maxApiKeys: 10,
          maxUsers: 5,
        });
        toast.success('Organization created successfully', {
          description: 'The organization is ready to use',
        });
      } else {
        toast.error('Failed to create organization', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to create organization', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOrganization = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      maxApiKeys: org.maxApiKeys,
      maxUsers: org.maxUsers,
    });
    setShowEditForm(true);
  };

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/organizations/${editingOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setShowEditForm(false);
        setEditingOrg(null);
        fetchOrganizations();
        toast.success('Organization updated successfully', {
          description: 'The organization has been updated',
        });
      } else {
        toast.error('Failed to update organization', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to update organization', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrganization = async (id: string) => {
    if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/organizations/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchOrganizations();
        toast.success('Organization deleted successfully', {
          description: 'The organization has been removed',
        });
      } else {
        toast.error('Failed to delete organization', {
          description: 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to delete organization', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const columns: Column<Organization>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      sortable: true,
      render: (row) => (
        <code className="text-sm bg-muted px-2 py-1 rounded">{row.slug}</code>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent/20 text-accent text-xs font-medium uppercase">
          {row.plan}
        </span>
      ),
    },
    {
      key: 'limits',
      header: 'Limits',
      render: (row) => (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Key className="h-3 w-3" />
            {row.maxApiKeys} keys
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {row.maxUsers} users
          </span>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            row.isActive
              ? 'bg-success/20 text-success'
              : 'bg-destructive/20 text-destructive'
          }`}
        >
          {row.isActive ? (
            <>
              <Check className="h-3 w-3" />
              Active
            </>
          ) : (
            <>
              <X className="h-3 w-3" />
              Inactive
            </>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditOrganization(row)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteOrganization(row.id)}
            className="text-destructive border-destructive hover:bg-destructive hover:text-white"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Organizations</h1>
            <p className="text-muted-foreground">
              Manage organizations and their API key allocations
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Create New Organization</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrganization} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Acme Corporation"
                    required
                  />

                  <Input
                    label="Slug"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
                    }
                    placeholder="acme-corp"
                    helpText="URL-friendly identifier"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Plan</label>
                    <select
                      value={formData.plan}
                      onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  <Input
                    label="Max API Keys"
                    type="number"
                    value={formData.maxApiKeys}
                    onChange={(e) =>
                      setFormData({ ...formData, maxApiKeys: parseInt(e.target.value) })
                    }
                    min="1"
                    required
                  />

                  <Input
                    label="Max Users"
                    type="number"
                    value={formData.maxUsers}
                    onChange={(e) =>
                      setFormData({ ...formData, maxUsers: parseInt(e.target.value) })
                    }
                    min="1"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={submitting}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Create Organization
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Edit Form */}
        {showEditForm && editingOrg && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Edit Organization - {editingOrg.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingOrg(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateOrganization} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />

                  <Input
                    label="Slug"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Plan</label>
                    <select
                      value={formData.plan}
                      onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  <Input
                    label="Max API Keys"
                    type="number"
                    value={formData.maxApiKeys}
                    onChange={(e) =>
                      setFormData({ ...formData, maxApiKeys: parseInt(e.target.value) })
                    }
                    min="1"
                  />

                  <Input
                    label="Max Users"
                    type="number"
                    value={formData.maxUsers}
                    onChange={(e) =>
                      setFormData({ ...formData, maxUsers: parseInt(e.target.value) })
                    }
                    min="1"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={submitting}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Update Organization
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Organizations List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <DataTable
                data={organizations}
                columns={columns}
                searchable
                searchPlaceholder="Search by name or slug..."
                pageSize={10}
                emptyMessage="No organizations created yet. Click 'Create Organization' to get started."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
