'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Input,
  Select,
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
  Users,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Key,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  apiKeyCount: number;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'user' as 'admin' | 'user',
    password: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.users || []);
    } catch (error) {
      toast.error('Failed to fetch users', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create user');
      }

      // Refresh the user list
      await fetchUsers();

      setShowCreateForm(false);
      setFormData({ email: '', name: '', role: 'user', password: '' });
      toast.success('User created successfully', {
        description: `${formData.email} has been added`,
      });
    } catch (error) {
      toast.error('Failed to create user', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          password: formData.password || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user');
      }

      // Refresh the user list
      await fetchUsers();

      setEditingUser(null);
      setFormData({ email: '', name: '', role: 'user', password: '' });
      toast.success('User updated successfully', {
        description: 'Changes have been saved',
      });
    } catch (error) {
      toast.error('Failed to update user', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !user.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user status');
      }

      // Refresh the user list
      await fetchUsers();

      toast.success('User status updated successfully', {
        description: `${user.email} is now ${!user.isActive ? 'active' : 'inactive'}`,
      });
    } catch (error) {
      toast.error('Failed to update user status', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (
      !confirm(
        `Are you sure you want to delete ${user.email}? This action cannot be undone.`
      )
    )
      return;

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete user');
      }

      // Refresh the user list
      await fetchUsers();

      toast.success('User deleted successfully', {
        description: `${user.email} has been removed`,
      });
    } catch (error) {
      toast.error('Failed to delete user', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      password: '',
    });
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setShowCreateForm(false);
    setFormData({ email: '', name: '', role: 'user', password: '' });
  };

  const columns: Column<User>[] = [
    {
      key: 'email',
      header: 'User',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.email}</span>
          </div>
          <span className="text-sm text-muted-foreground">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            row.role === 'admin'
              ? 'bg-accent/20 text-accent'
              : 'bg-muted text-foreground'
          }`}
        >
          <Shield className="h-3 w-3" />
          {row.role.charAt(0).toUpperCase() + row.role.slice(1)}
        </span>
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
              <CheckCircle className="h-3 w-3" />
              Active
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              Inactive
            </>
          )}
        </span>
      ),
    },
    {
      key: 'apiKeyCount',
      header: 'API Keys',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1 text-sm">
          <Key className="h-3 w-3 text-muted-foreground" />
          {row.apiKeyCount}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(row.createdAt).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: 'lastActiveAt',
      header: 'Last Active',
      sortable: true,
      render: (row) => (
        <div className="text-sm text-muted-foreground">
          {row.lastActiveAt
            ? new Date(row.lastActiveAt).toLocaleDateString()
            : 'Never'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditUser(row)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleUserStatus(row)}
            className={row.isActive ? 'text-destructive' : 'text-success'}
          >
            {row.isActive ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteUser(row)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              Manage users and their permissions for the API gateway
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>


        {/* Create/Edit Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="user@example.com"
                    required
                  />

                  <Input
                    label="Full Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Select
                    label="Role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as 'admin' | 'user',
                      })
                    }
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </Select>

                  <Input
                    label={editingUser ? 'New Password (optional)' : 'Password'}
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                    required={!editingUser}
                  />
                </div>

                <Button type="submit" className="w-full" isLoading={submitting}>
                  <Users className="h-4 w-4 mr-2" />
                  {editingUser ? 'Update User' : 'Create User'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <DataTable
                data={users}
                columns={columns}
                searchable
                searchPlaceholder="Search by email or name..."
                pageSize={10}
                emptyMessage="No users found. Click 'Add User' to create the first user."
                rowClassName={(row) => (!row.isActive ? 'opacity-60' : '')}
              />
            )}
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.isActive).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.role === 'admin').length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-accent" />
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
