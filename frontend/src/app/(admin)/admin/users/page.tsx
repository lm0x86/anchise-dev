'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Shield,
  Building2,
  User,
  Edit,
  Loader2,
} from 'lucide-react';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'PARTNER' | 'ADMIN';
  emailVerified: boolean;
  createdAt: string;
  partnerName?: string;
}

interface UsersResponse {
  users: UserRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const roleLabels = {
  USER: 'User',
  PARTNER: 'Partner',
  ADMIN: 'Admin',
};

const roleIcons = {
  USER: User,
  PARTNER: Building2,
  ADMIN: Shield,
};

const roleColors = {
  USER: 'bg-gray-500/10 text-gray-400',
  PARTNER: 'bg-blue-500/10 text-blue-400',
  ADMIN: 'bg-purple-500/10 text-purple-400',
};

async function fetchUsers(
  token: string,
  page: number,
  limit: number,
  role?: string
): Promise<UsersResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (role && role !== 'ALL') {
    params.append('role', role);
  }

  const response = await fetch(`${API_URL}/admin/users?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

async function searchUsers(
  token: string,
  query: string
): Promise<UserRecord[]> {
  if (!query || query.length < 2) return [];

  const response = await fetch(
    `${API_URL}/admin/users/search?q=${encodeURIComponent(query)}&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to search users');
  }

  return response.json();
}

async function updateUserRole(
  token: string,
  userId: string,
  role: string
): Promise<UserRecord> {
  const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update user role');
  }

  return response.json();
}

function RoleBadge({ role }: { role: UserRecord['role'] }) {
  const Icon = roleIcons[role];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        roleColors[role]
      )}
    >
      <Icon className="w-3 h-3" />
      {roleLabels[role]}
    </span>
  );
}

export default function AdminUsersPage() {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  
  // Edit dialog state
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editRole, setEditRole] = useState<string>('USER');

  // Debounce search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 2) {
      setIsSearchMode(true);
      setTimeout(() => {
        setDebouncedSearch(value);
      }, 300);
    } else {
      setIsSearchMode(false);
      setDebouncedSearch('');
    }
  };

  // Regular paginated list
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', token, page, limit, roleFilter],
    queryFn: () => fetchUsers(token!, page, limit, roleFilter),
    enabled: !!token && !isSearchMode,
  });

  // Search results
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['admin', 'users', 'search', token, debouncedSearch],
    queryFn: () => searchUsers(token!, debouncedSearch),
    enabled: !!token && isSearchMode && debouncedSearch.length >= 2,
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateUserRole(token!, userId, role),
    onSuccess: (updatedUser) => {
      toast.success(`${updatedUser.firstName}'s role updated to ${roleLabels[updatedUser.role]}`);
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEditUser = (user: UserRecord) => {
    setEditUser(user);
    setEditRole(user.role);
  };

  const handleSaveRole = () => {
    if (editUser) {
      updateRoleMutation.mutate({ userId: editUser.id, role: editRole });
    }
  };

  // Determine which data to display
  const displayUsers = isSearchMode ? searchResults : data?.users;
  const isLoadingData = isSearchMode ? isSearching : isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold">Users</h1>
        <p className="text-muted-foreground mt-1">
          Manage registered users on the platform
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-40">
          <Select 
            value={roleFilter} 
            onValueChange={(value) => {
              setRoleFilter(value);
              setPage(1);
            }}
            disabled={isSearchMode}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              <SelectItem value="USER">Users</SelectItem>
              <SelectItem value="PARTNER">Partners</SelectItem>
              <SelectItem value="ADMIN">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isSearchMode && data && (
          <div className="text-sm text-muted-foreground self-center">
            {data.total.toLocaleString()} total users
          </div>
        )}
        {isSearchMode && searchResults && (
          <div className="text-sm text-muted-foreground self-center">
            {searchResults.length} results
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoadingData ? (
          <div className="p-6 space-y-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !displayUsers || displayUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No users found</h3>
            <p className="text-muted-foreground mt-1">
              {isSearchMode
                ? `No users match "${searchQuery}"`
                : roleFilter !== 'ALL'
                  ? `No ${roleLabels[roleFilter as keyof typeof roleLabels]?.toLowerCase()}s found`
                  : 'No users registered yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-sm">User</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Partner</th>
                  <th className="text-center py-3 px-4 font-medium text-sm">Verified</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Joined</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center text-primary text-sm font-medium">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="py-3 px-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {user.partnerName || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {user.emailVerified ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination - only show when not searching */}
        {!isSearchMode && data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, data.total)} of {data.total.toLocaleString()} users
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {/* Show page numbers */}
                {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (data.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= data.totalPages - 2) {
                    pageNum = data.totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'ghost'}
                      size="sm"
                      className="w-9 h-9 p-0"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page === data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Change role for {editUser?.firstName} {editUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* User Info */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary font-medium">
                {editUser?.firstName[0]}{editUser?.lastName[0]}
              </div>
              <div>
                <p className="font-medium">
                  {editUser?.firstName} {editUser?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{editUser?.email}</p>
              </div>
            </div>

            {/* Role Select */}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      User - Regular user
                    </div>
                  </SelectItem>
                  <SelectItem value="PARTNER">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Partner - Can manage partner organization
                    </div>
                  </SelectItem>
                  <SelectItem value="ADMIN">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Admin - Full platform access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editRole === 'ADMIN' && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-500">
                  ⚠️ Admin users have full access to the platform, including user management and all settings.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRole}
              disabled={updateRoleMutation.isPending || editRole === editUser?.role}
            >
              {updateRoleMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
