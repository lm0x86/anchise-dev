'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Users,
  Edit,
  UserPlus,
  Loader2,
  X,
  Clock,
} from 'lucide-react';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Partner {
  id: string;
  name: string;
  slug: string;
  type: 'FUNERAL_HOME' | 'CHURCH' | 'HOSPITAL' | 'OTHER';
  contactEmail: string;
  logoUrl: string | null;
  verified: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  profileCount?: number;
}

interface PartnersResponse {
  partners: Partner[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const partnerTypeLabels = {
  FUNERAL_HOME: 'Funeral Home',
  CHURCH: 'Church',
  HOSPITAL: 'Hospital',
  OTHER: 'Other',
};

// Schemas
const createPartnerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  type: z.enum(['FUNERAL_HOME', 'CHURCH', 'HOSPITAL', 'OTHER']),
  contactEmail: z.string().email('Invalid email address'),
});

// User search result type
interface UserSearchResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
  partnerName?: string;
}

type CreatePartnerForm = z.infer<typeof createPartnerSchema>;

// API functions
async function fetchPartners(
  token: string,
  page: number,
  search?: string,
  status?: string
): Promise<PartnersResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '20',
  });
  if (search) {
    params.append('search', search);
  }
  if (status && status !== 'ALL') {
    params.append('status', status);
  }

  // Use admin endpoint to see all partners including pending/rejected
  const response = await fetch(`${API_URL}/partners/admin/all?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch partners');
  }

  return response.json();
}

async function createPartner(
  token: string,
  data: CreatePartnerForm
): Promise<Partner> {
  const response = await fetch(`${API_URL}/partners`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create partner');
  }

  return response.json();
}

async function uploadPartnerLogo(
  token: string,
  partnerId: string,
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/uploads/partner/${partnerId}/logo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload logo');
  }

  const result = await response.json();
  return result.url;
}

async function updatePartner(
  token: string,
  id: string,
  data: Partial<CreatePartnerForm & { verified: boolean }>
): Promise<Partner> {
  const response = await fetch(`${API_URL}/partners/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update partner');
  }

  return response.json();
}

async function searchUsers(
  token: string,
  query: string
): Promise<UserSearchResult[]> {
  if (!query || query.length < 2) return [];

  const response = await fetch(
    `${API_URL}/admin/users/search?q=${encodeURIComponent(query)}&limit=10`,
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

async function assignUserToPartner(
  token: string,
  partnerId: string,
  userId: string,
  role: string = 'MEMBER'
): Promise<void> {
  const response = await fetch(`${API_URL}/partners/${partnerId}/assign/${userId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to assign user');
  }
}

// Components
function PartnerCard({
  partner,
  onEdit,
  onInvite,
  onToggleVerify,
}: {
  partner: Partner;
  onEdit: () => void;
  onInvite: () => void;
  onToggleVerify: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Logo */}
        {partner.logoUrl ? (
          <img
            src={partner.logoUrl}
            alt={partner.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
            {partner.name[0]}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold truncate">{partner.name}</h3>
              <p className="text-sm text-muted-foreground">
                {partnerTypeLabels[partner.type]}
              </p>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onInvite}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onToggleVerify}>
                  {partner.verified ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Remove Verification
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Verify Partner
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="text-sm text-muted-foreground mt-1 truncate">
            {partner.contactEmail}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {partner.profileCount ?? 0} memorials
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          {partner.status === 'PENDING' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
              <Clock className="h-3 w-3" />
              Pending
            </span>
          )}
          {partner.status === 'REJECTED' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
              <XCircle className="h-3 w-3" />
              Rejected
            </span>
          )}
          {/* Verified Badge (only for approved partners) */}
          {partner.status === 'APPROVED' && partner.verified && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </span>
          )}
          {partner.status === 'APPROVED' && !partner.verified && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
              <CheckCircle2 className="h-3 w-3" />
              Approved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPartnersPage() {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [invitePartner, setInvitePartner] = useState<Partner | null>(null);

  // Debounce search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'partners', token, page, debouncedSearch, statusFilter],
    queryFn: () => fetchPartners(token!, page, debouncedSearch, statusFilter),
    enabled: !!token,
  });

  // Logo state for dialogs
  const [editLogoUrl, setEditLogoUrl] = useState<string | null>(null);

  // Create form
  const createForm = useForm<CreatePartnerForm>({
    resolver: zodResolver(createPartnerSchema),
    defaultValues: {
      name: '',
      type: 'FUNERAL_HOME',
      contactEmail: '',
    },
  });

  // Edit form
  const editForm = useForm<CreatePartnerForm>({
    resolver: zodResolver(createPartnerSchema),
  });

  // User search state for invite dialog
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER'>('MEMBER');

  // User search query
  const { data: userSearchResults, isLoading: isSearchingUsers } = useQuery({
    queryKey: ['admin', 'users', 'search', token, debouncedUserSearch],
    queryFn: () => searchUsers(token!, debouncedUserSearch),
    enabled: !!token && debouncedUserSearch.length >= 2,
  });

  // Debounce user search
  const handleUserSearch = (value: string) => {
    setUserSearchQuery(value);
    setSelectedUser(null);
    setTimeout(() => {
      setDebouncedUserSearch(value);
    }, 300);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreatePartnerForm) => createPartner(token!, data),
    onSuccess: () => {
      toast.success('Partner created successfully');
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreatePartnerForm & { verified: boolean }>;
    }) => updatePartner(token!, id, data),
    onSuccess: () => {
      toast.success('Partner updated successfully');
      setEditPartner(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ partnerId, userId, role }: { partnerId: string; userId: string; role: string }) =>
      assignUserToPartner(token!, partnerId, userId, role),
    onSuccess: () => {
      toast.success('User assigned to partner successfully');
      setInvitePartner(null);
      setSelectedUser(null);
      setUserSearchQuery('');
      setDebouncedUserSearch('');
      setSelectedRole('MEMBER');
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = (data: CreatePartnerForm) => {
    createMutation.mutate(data);
  };

  const handleEdit = (data: CreatePartnerForm) => {
    if (editPartner) {
      updateMutation.mutate({ id: editPartner.id, data });
    }
  };

  const handleAssignUser = () => {
    if (invitePartner && selectedUser) {
      assignMutation.mutate({
        partnerId: invitePartner.id,
        userId: selectedUser.id,
        role: selectedRole,
      });
    }
  };

  const handleToggleVerify = (partner: Partner) => {
    const newVerified = !partner.verified;
    updateMutation.mutate({
      id: partner.id,
      data: { 
        verified: newVerified,
        // If verifying a pending partner, also approve them
        ...(newVerified && partner.status === 'PENDING' && { status: 'APPROVED' }),
      },
    });
  };

  const openEditDialog = (partner: Partner) => {
    editForm.reset({
      name: partner.name,
      type: partner.type,
      contactEmail: partner.contactEmail,
    });
    setEditLogoUrl(partner.logoUrl);
    setEditPartner(partner);
  };

  const handleLogoUpload = async (file: File, partnerId: string): Promise<string> => {
    const url = await uploadPartnerLogo(token!, partnerId, file);
    // Also update the partner record with the new logo URL
    await updatePartner(token!, partnerId, { logoUrl: url } as any);
    queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] });
    return url;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Partners</h1>
          <p className="text-muted-foreground mt-1">
            Manage funeral homes, churches, and other partners
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Partner
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search partners..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select 
          value={statusFilter} 
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : data?.partners.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          {debouncedSearch ? (
            <>
              <h3 className="font-semibold">No results found</h3>
              <p className="text-muted-foreground mt-1">
                No partners match &quot;{debouncedSearch}&quot;
              </p>
            </>
          ) : (
            <>
              <h3 className="font-semibold">No partners yet</h3>
              <p className="text-muted-foreground mt-1">
                Add your first partner to get started
              </p>
              <Button onClick={() => setCreateOpen(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.partners.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onEdit={() => openEditDialog(partner)}
                onInvite={() => setInvitePartner(partner)}
                onToggleVerify={() => handleToggleVerify(partner)}
              />
            ))}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Partner</DialogTitle>
            <DialogDescription>
              Create a new partner organization. You can upload a logo after creation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Organization Name</Label>
                <Input
                  id="create-name"
                  {...createForm.register('name')}
                  placeholder="Pompes Funèbres Générales"
                />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-type">Type</Label>
                <Select
                  value={createForm.watch('type')}
                  onValueChange={(value) =>
                    createForm.setValue('type', value as CreatePartnerForm['type'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FUNERAL_HOME">Funeral Home</SelectItem>
                    <SelectItem value="CHURCH">Church</SelectItem>
                    <SelectItem value="HOSPITAL">Hospital</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-email">Contact Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  {...createForm.register('contactEmail')}
                  placeholder="contact@example.com"
                />
                {createForm.formState.errors.contactEmail && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.contactEmail.message}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Partner
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editPartner} onOpenChange={() => setEditPartner(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>
              Update partner organization details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)}>
            <div className="space-y-4 py-4">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo</Label>
                <ImageUpload
                  value={editLogoUrl}
                  onChange={(url) => setEditLogoUrl(url)}
                  onUpload={async (file) => {
                    if (!editPartner) throw new Error('No partner selected');
                    const url = await handleLogoUpload(file, editPartner.id);
                    return url;
                  }}
                  aspectRatio="square"
                  placeholder="Upload logo"
                  className="max-w-[200px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name">Organization Name</Label>
                <Input id="edit-name" {...editForm.register('name')} />
                {editForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  value={editForm.watch('type')}
                  onValueChange={(value) =>
                    editForm.setValue('type', value as CreatePartnerForm['type'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FUNERAL_HOME">Funeral Home</SelectItem>
                    <SelectItem value="CHURCH">Church</SelectItem>
                    <SelectItem value="HOSPITAL">Hospital</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Contact Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  {...editForm.register('contactEmail')}
                />
                {editForm.formState.errors.contactEmail && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.contactEmail.message}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditPartner(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog
        open={!!invitePartner}
        onOpenChange={(open) => {
          if (!open) {
            setInvitePartner(null);
            setSelectedUser(null);
            setUserSearchQuery('');
            setDebouncedUserSearch('');
            setSelectedRole('MEMBER');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User</DialogTitle>
            <DialogDescription>
              Search for an existing user to assign to {invitePartner?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* User Search */}
            <div className="space-y-2">
              <Label>Search User</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={userSearchQuery}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Search Results */}
              {debouncedUserSearch.length >= 2 && (
                <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                  {isSearchingUsers ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Searching...
                    </div>
                  ) : userSearchResults && userSearchResults.length > 0 ? (
                    <div className="divide-y divide-border">
                      {userSearchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setUserSearchQuery(`${user.firstName} ${user.lastName}`);
                          }}
                          className={cn(
                            'w-full text-left px-4 py-3 hover:bg-accent transition-colors',
                            selectedUser?.id === user.id && 'bg-accent'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {user.role}
                              </span>
                              {user.partnerName && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                  {user.partnerName}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      No users found. Users must register on the platform first.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected User */}
            {selectedUser && (
              <div className="bg-accent/50 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-medium">
                      {selectedUser.firstName[0]}{selectedUser.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium">
                        {selectedUser.firstName} {selectedUser.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedUser(null);
                      setUserSearchQuery('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Role in Organization</Label>
              <Select
                value={selectedRole}
                onValueChange={(value: 'OWNER' | 'ADMIN' | 'MEMBER') => setSelectedRole(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground">
              The user must already be registered on the platform. Search by their email or name to find them.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInvitePartner(null);
                setSelectedUser(null);
                setUserSearchQuery('');
                setDebouncedUserSearch('');
                setSelectedRole('MEMBER');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignUser}
              disabled={!selectedUser || assignMutation.isPending}
            >
              {assignMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Assign User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
