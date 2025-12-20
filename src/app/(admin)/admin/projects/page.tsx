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
  FolderKanban,
  Building2,
  Edit,
  Trash,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  organizationId: string;
  sharedQuota: number | null;
  createdAt: string;
  organization?: Organization;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    organizationId: '',
    sharedQuota: 0,
  });

  useEffect(() => {
    fetchProjects();
    fetchOrganizations();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/admin/projects');
      const data = await response.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch {
      toast.error('Failed to fetch projects', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/admin/organizations');
      const data = await response.json();
      if (data.organizations) {
        setOrganizations(data.organizations.filter((org: { isActive: boolean }) => org.isActive));
      }
    } catch {
      toast.error('Failed to fetch organizations', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          sharedQuota: formData.sharedQuota || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowCreateForm(false);
        fetchProjects();
        setFormData({
          name: '',
          organizationId: '',
          sharedQuota: 0,
        });
        toast.success('Project created successfully', {
          description: 'The project is ready to use',
        });
      } else {
        toast.error('Failed to create project', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to create project', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      organizationId: project.organizationId,
      sharedQuota: project.sharedQuota || 0,
    });
    setShowEditForm(true);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          sharedQuota: formData.sharedQuota || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowEditForm(false);
        setEditingProject(null);
        fetchProjects();
        toast.success('Project updated successfully', {
          description: 'The project has been updated',
        });
      } else {
        toast.error('Failed to update project', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to update project', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/projects/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchProjects();
        toast.success('Project deleted successfully', {
          description: 'The project has been removed',
        });
      } else {
        toast.error('Failed to delete project', {
          description: 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to delete project', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const columns: Column<Project>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'organization',
      header: 'Organization',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{row.organization?.name || 'Unknown'}</span>
        </div>
      ),
    },
    {
      key: 'sharedQuota',
      header: 'Shared Quota',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.sharedQuota ? `$${row.sharedQuota.toLocaleString()}/month` : 'No limit'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
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
            onClick={() => handleEditProject(row)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteProject(row.id)}
            className="text-destructive border-destructive hover:bg-destructive hover:text-white"
          >
            <Trash className="h-4 w-4" />
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
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground">
              Manage projects and their shared quota allocations
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Create New Project</CardTitle>
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
              <form onSubmit={handleCreateProject} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Project Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="My Project"
                    required
                  />

                  <div>
                    <label className="mb-2 block text-sm font-medium">Organization</label>
                    <select
                      value={formData.organizationId}
                      onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      required
                    >
                      <option value="">Select an organization</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Input
                  label="Shared Monthly Quota (USD)"
                  type="number"
                  value={formData.sharedQuota}
                  onChange={(e) =>
                    setFormData({ ...formData, sharedQuota: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                  placeholder="0"
                  helpText="Maximum monthly spend for all API keys in this project. Leave at 0 for no limit."
                />

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={submitting}
                  disabled={organizations.length === 0}
                >
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Edit Form */}
        {showEditForm && editingProject && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Edit Project - {editingProject.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingProject(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProject} className="space-y-6">
                <Input
                  label="Project Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />

                <Input
                  label="Shared Monthly Quota (USD)"
                  type="number"
                  value={formData.sharedQuota}
                  onChange={(e) =>
                    setFormData({ ...formData, sharedQuota: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                  helpText="Maximum monthly spend for all API keys in this project. Leave at 0 for no limit."
                />

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={submitting}
                >
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Update Project
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Projects List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <DataTable
                data={projects}
                columns={columns}
                searchable
                searchPlaceholder="Search by project name..."
                pageSize={10}
                emptyMessage="No projects created yet. Click 'Create Project' to get started."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
