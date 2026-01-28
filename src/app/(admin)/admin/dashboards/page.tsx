'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Select,
  AlertCard,
} from '@/components/ui';
import {
  LayoutDashboard,
  Plus,
  Edit,
  Trash2,
  Eye,
  Share2,
  RefreshCw,
  Settings,
  Star,
  Globe,
  Lock,
  Users,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import type { Dashboard } from '@/components/dashboard-builder/types';

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);

  useEffect(() => {
    fetchDashboards();
  }, []);

  const fetchDashboards = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/dashboards');
      const data = await response.json();

      if (data.success && data.dashboards) {
        setDashboards(data.dashboards);
      } else {
        toast.error('Failed to fetch dashboards', {
          description: data.error || 'An unexpected error occurred',
        });
      }
    } catch {
      toast.error('Failed to fetch dashboards', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDashboard = async (dashboardData: Partial<Dashboard>) => {
    try {
      const response = await fetch('/api/admin/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dashboardData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Dashboard created successfully');
        fetchDashboards();
        setShowCreateModal(false);
      } else {
        toast.error('Failed to create dashboard', {
          description: data.error,
        });
      }
    } catch {
      toast.error('Failed to create dashboard', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const handleDeleteDashboard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dashboard?')) return;

    try {
      const response = await fetch(`/api/admin/dashboards?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Dashboard deleted successfully');
        fetchDashboards();
      } else {
        toast.error('Failed to delete dashboard', {
          description: data.error,
        });
      }
    } catch {
      toast.error('Failed to delete dashboard', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const handleUpdateDashboard = async (id: string, dashboardData: Partial<Dashboard>) => {
    try {
      const response = await fetch(`/api/admin/dashboards?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dashboardData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Dashboard updated successfully');
        fetchDashboards();
        setEditingDashboard(null);
      } else {
        toast.error('Failed to update dashboard', {
          description: data.error,
        });
      }
    } catch {
      toast.error('Failed to update dashboard', {
        description: 'An unexpected error occurred',
      });
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Globe className="h-4 w-4" />;
      case 'organization':
        return <Users className="h-4 w-4" />;
      default:
        return <Lock className="h-4 w-4" />;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return 'Public';
      case 'organization':
        return 'Organization';
      default:
        return 'Private';
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <LayoutDashboard className="h-8 w-8" />
              Custom Dashboards
            </h1>
            <p className="text-muted-foreground">
              Create and manage custom analytics dashboards
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={fetchDashboards} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Dashboard
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <AlertCard variant="info">
          <p className="text-sm">
            Custom dashboards allow you to create personalized views of your analytics data.
            Add widgets, configure layouts, and share with your team.
          </p>
        </AlertCard>

        {/* Dashboard Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : dashboards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboards.map((dashboard) => (
              <Card
                key={dashboard.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedDashboard(dashboard)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {dashboard.name}
                        {dashboard.isDefault && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                      </CardTitle>
                      {dashboard.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {dashboard.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {getVisibilityIcon(dashboard.visibility)}
                      <span>{getVisibilityLabel(dashboard.visibility)}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {dashboard.widgets.length} widgets
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p>Views: {dashboard.viewCount}</p>
                    <p>
                      Last updated:{' '}
                      {new Date(dashboard.updatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDashboard(dashboard);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingDashboard(dashboard);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    {dashboard.visibility === 'public' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(
                            `${window.location.origin}/shared/dashboard/${dashboard.shareToken}`
                          );
                          toast.success('Share link copied to clipboard');
                        }}
                      >
                        <Share2 className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDashboard(dashboard.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Dashboards</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Create your first custom dashboard to start organizing your analytics data.
                </p>
                <Button onClick={() => setShowCreateModal(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Dashboard
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Create Dashboard Modal */}
        {showCreateModal && (
          <CreateDashboardModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateDashboard}
          />
        )}

        {/* View Dashboard Modal */}
        {selectedDashboard && (
          <ViewDashboardModal
            dashboard={selectedDashboard}
            onClose={() => setSelectedDashboard(null)}
          />
        )}

        {/* Edit Dashboard Modal */}
        {editingDashboard && (
          <EditDashboardModal
            dashboard={editingDashboard}
            onClose={() => setEditingDashboard(null)}
            onUpdate={(data) => handleUpdateDashboard(editingDashboard.id, data)}
          />
        )}
      </div>
    </AppLayout>
  );
}

function CreateDashboardModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: Partial<Dashboard>) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'organization' | 'public'>('private');
  const [template, setTemplate] = useState<'blank' | 'overview' | 'cost'>('blank');

  const getTemplateWidgets = () => {
    switch (template) {
      case 'overview':
        return [
          {
            id: '1',
            type: 'metric' as const,
            title: 'Total Requests',
            config: { dataSource: '/api/admin/analytics' },
            position: { x: 0, y: 0, w: 3, h: 2 },
          },
          {
            id: '2',
            type: 'metric' as const,
            title: 'Total Cost',
            config: { dataSource: '/api/admin/analytics' },
            position: { x: 3, y: 0, w: 3, h: 2 },
          },
          {
            id: '3',
            type: 'line-chart' as const,
            title: 'Requests Over Time',
            config: { dataSource: '/api/admin/analytics' },
            position: { x: 0, y: 2, w: 6, h: 4 },
          },
        ];
      case 'cost':
        return [
          {
            id: '1',
            type: 'metric' as const,
            title: 'Current Spend',
            config: { dataSource: '/api/admin/analytics/budgets' },
            position: { x: 0, y: 0, w: 3, h: 2 },
          },
          {
            id: '2',
            type: 'metric' as const,
            title: 'Burn Rate',
            config: { dataSource: '/api/admin/analytics/budgets' },
            position: { x: 3, y: 0, w: 3, h: 2 },
          },
          {
            id: '3',
            type: 'donut-chart' as const,
            title: 'Cost by Model',
            config: { dataSource: '/api/admin/analytics/budgets' },
            position: { x: 0, y: 2, w: 6, h: 4 },
          },
        ];
      default:
        return [];
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a dashboard name');
      return;
    }

    const widgets = getTemplateWidgets();

    onCreate({
      name,
      description: description || undefined,
      visibility,
      layout: { cols: 12, rowHeight: 30 },
      widgets,
      refreshInterval: 300,
      theme: 'light',
      isDefault: false,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Dashboard Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Dashboard"
              required
            />

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Visibility</label>
              <Select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'private' | 'organization' | 'public')}
              >
                <option value="private">Private</option>
                <option value="organization">Organization</option>
                <option value="public">Public</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Template</label>
              <Select
                value={template}
                onChange={(e) => setTemplate(e.target.value as 'blank' | 'overview' | 'cost')}
              >
                <option value="blank">Blank Dashboard</option>
                <option value="overview">Overview Template</option>
                <option value="cost">Cost Analytics Template</option>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Templates provide pre-configured widgets to get started quickly
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Create Dashboard</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ViewDashboardModal({
  dashboard,
  onClose,
}: {
  dashboard: Dashboard;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {dashboard.name}
              {dashboard.isDefault && (
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
          {dashboard.description && (
            <p className="text-sm text-muted-foreground mt-1">{dashboard.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                {getVisibilityIcon(dashboard.visibility)}
                <span>{getVisibilityLabel(dashboard.visibility)}</span>
              </div>
              <div>•</div>
              <div>{dashboard.widgets.length} widgets</div>
              <div>•</div>
              <div>{dashboard.viewCount} views</div>
            </div>

            {/* Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard.widgets.map((widget) => (
                <Card key={widget.id} variant="outlined">
                  <CardHeader>
                    <CardTitle className="text-sm">{widget.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-32 bg-muted rounded">
                      <div className="text-center text-muted-foreground">
                        <Settings className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-xs">{widget.type}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {dashboard.widgets.length === 0 && (
              <div className="text-center py-12">
                <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  This dashboard has no widgets yet
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditDashboardModal({
  dashboard,
  onClose,
  onUpdate,
}: {
  dashboard: Dashboard;
  onClose: () => void;
  onUpdate: (data: Partial<Dashboard>) => void;
}) {
  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description ?? '');
  const [visibility, setVisibility] = useState<'private' | 'organization' | 'public'>(
    (dashboard.visibility as 'private' | 'organization' | 'public') ?? 'private'
  );
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>(
    (dashboard.theme as 'light' | 'dark' | 'auto') ?? 'light'
  );
  const [refreshInterval, setRefreshInterval] = useState<number>(dashboard.refreshInterval ?? 300);
  const [isDefault, setIsDefault] = useState<boolean>(dashboard.isDefault ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a dashboard name');
      return;
    }

    onUpdate({
      name,
      description: description || undefined,
      visibility,
      theme,
      refreshInterval,
      isDefault,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Edit Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Dashboard Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Dashboard"
              required
            />

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Visibility</label>
              <Select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'private' | 'organization' | 'public')}
              >
                <option value="private">Private</option>
                <option value="organization">Organization</option>
                <option value="public">Public</option>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Public dashboards generate a share link.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">Theme</label>
                <Select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'auto')}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Refresh Interval</label>
                <Select
                  value={String(refreshInterval)}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                >
                  <option value="60">1 minute</option>
                  <option value="300">5 minutes</option>
                  <option value="600">10 minutes</option>
                  <option value="900">15 minutes</option>
                  <option value="1800">30 minutes</option>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Star className={`h-4 w-4 ${isDefault ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                <span className="text-sm">Set as default</span>
              </div>
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function getVisibilityIcon(visibility: string) {
  switch (visibility) {
    case 'public':
      return <Globe className="h-4 w-4" />;
    case 'organization':
      return <Users className="h-4 w-4" />;
    default:
      return <Lock className="h-4 w-4" />;
  }
}

function getVisibilityLabel(visibility: string) {
  switch (visibility) {
    case 'public':
      return 'Public';
    case 'organization':
      return 'Organization';
    default:
      return 'Private';
  }
}
