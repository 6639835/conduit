'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Select,
  AlertCard,
} from '@/components/ui';
import {
  Shield,
  Users,
  UserCog,
  Eye,
  Crown,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organizationId: string | null;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string;
  apiKeyCount: number;
}

interface Role {
  id: string;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  permissions: string[];
  permissionCount: number;
}

interface RoleData {
  roles: Role[];
  permissions: string[];
  permissionsByCategory: Record<string, string[]>;
  currentAdminRole: string;
}

export default function RolesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roleData, setRoleData] = useState<RoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [currentAdminRole, setCurrentAdminRole] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showPermissionMatrix, setShowPermissionMatrix] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/roles'),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
        setCanManageUsers(usersData.canManageUsers || false);
        setCurrentAdminRole(usersData.currentAdminRole || '');
      }

      if (rolesRes.ok) {
        const rolesDataJson = await rolesRes.json();
        setRoleData(rolesDataJson.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data', {
        description: 'Please try again later',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Role updated successfully', {
          description: `User role changed to ${data.data?.newRole}`,
        });
        fetchData(); // Refresh data
      } else {
        toast.error('Failed to update role', {
          description: data.error || 'An error occurred',
        });
      }
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role', {
        description: 'Please try again later',
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-5 w-5" />;
      case 'org_admin':
        return <UserCog className="h-5 w-5" />;
      case 'viewer':
        return <Eye className="h-5 w-5" />;
      default:
        return <Users className="h-5 w-5" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'org_admin':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const selectedRoleData = roleData?.roles.find(r => r.id === selectedRole);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Role Management
            </h1>
            <p className="text-muted-foreground">
              Manage admin users and assign roles with fine-grained permissions
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPermissionMatrix(!showPermissionMatrix)}
            >
              {showPermissionMatrix ? 'Hide' : 'Show'} Permission Matrix
            </Button>
            <Button onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Current Admin Role */}
        <AlertCard variant="info">
          <p className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Your current role: <strong>{roleData?.roles.find(r => r.id === currentAdminRole)?.label}</strong>
            {!canManageUsers && ' (Read-only access)'}
          </p>
        </AlertCard>

        {/* Role Summary Cards */}
        {roleData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roleData.roles.map(role => {
              const userCount = users.filter(u => u.role === role.id).length;
              return (
                <Card
                  key={role.id}
                  className={`cursor-pointer transition-all ${
                    selectedRole === role.id
                      ? 'ring-2 ring-accent'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedRole(selectedRole === role.id ? null : role.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-full ${role.bgColor}`}>
                        <div className={role.color}>
                          {getRoleIcon(role.id)}
                        </div>
                      </div>
                      <span className="text-2xl font-bold">{userCount}</span>
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{role.label}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {role.permissionCount} permissions
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Selected Role Details */}
        {selectedRoleData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getRoleIcon(selectedRoleData.id)}
                {selectedRoleData.label} Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {selectedRoleData.permissions.map(permission => (
                  <div
                    key={permission}
                    className="flex items-center gap-2 text-sm p-2 rounded bg-muted"
                  >
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="truncate">{permission}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Permission Matrix */}
        {showPermissionMatrix && roleData && (
          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-3 border-b font-semibold">Permission</th>
                      {roleData.roles.map(role => (
                        <th key={role.id} className="text-center p-3 border-b font-semibold">
                          {role.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(roleData.permissionsByCategory).map(([category, permissions]) => (
                      <>
                        <tr key={category}>
                          <td
                            colSpan={roleData.roles.length + 1}
                            className="p-3 bg-muted font-semibold text-sm uppercase tracking-wide"
                          >
                            {category}
                          </td>
                        </tr>
                        {permissions.map(permission => (
                          <tr key={permission} className="border-b hover:bg-muted/50">
                            <td className="p-3 text-sm">{permission}</td>
                            {roleData.roles.map(role => (
                              <td key={role.id} className="p-3 text-center">
                                {role.permissions.includes(permission) ? (
                                  <Check className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <X className="h-5 w-5 text-gray-300 mx-auto" />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Admin Users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold">User</th>
                      <th className="text-left p-3 font-semibold">Role</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="text-right p-3 font-semibold">API Keys</th>
                      <th className="text-right p-3 font-semibold">Last Active</th>
                      {canManageUsers && (
                        <th className="text-right p-3 font-semibold">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{user.name || 'Unnamed'}</span>
                            <span className="text-sm text-muted-foreground">{user.email}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeClass(
                              user.role
                            )}`}
                          >
                            {getRoleIcon(user.role)}
                            {roleData?.roles.find(r => r.id === user.role)?.label || user.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              user.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3 text-right">{user.apiKeyCount}</td>
                        <td className="p-3 text-right text-sm text-muted-foreground">
                          {new Date(user.lastActiveAt).toLocaleDateString()}
                        </td>
                        {canManageUsers && (
                          <td className="p-3 text-right">
                            <Select
                              value={user.role}
                              onChange={e => handleRoleChange(user.id, e.target.value)}
                              className="w-40 text-sm"
                            >
                              {roleData?.roles.map(role => (
                                <option key={role.id} value={role.id}>
                                  {role.label}
                                </option>
                              ))}
                            </Select>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RBAC Info */}
        <Card>
          <CardHeader>
            <CardTitle>How Role-Based Access Control Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  <h4 className="font-semibold">Super Admin</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Full system access across all organizations. Can manage all resources,
                  create other admins, and configure system settings.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-blue-600" />
                  <h4 className="font-semibold">Organization Admin</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Full access within assigned organization. Can manage API keys, users,
                  and settings for their organization only.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-gray-600" />
                  <h4 className="font-semibold">Viewer</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Read-only access to organization resources. Can view analytics, logs,
                  and reports but cannot make changes.
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Important Security Notes</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Only super admins can promote users to super admin</li>
                    <li>Organization admins can only manage users within their organization</li>
                    <li>The last super admin cannot be demoted</li>
                    <li>All role changes are logged in the audit trail</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
