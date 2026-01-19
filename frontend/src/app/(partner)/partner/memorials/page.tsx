'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  MapPin,
} from 'lucide-react';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Memorial {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  deathDate: string;
  deathPlaceLabel: string | null;
  photoUrl: string | null;
  isLocked: boolean;
  createdAt: string;
  _count?: {
    tributes: number;
  };
}

interface MemorialsResponse {
  profiles: Memorial[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function fetchMemorials(
  token: string,
  page: number,
  search?: string
): Promise<MemorialsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '20',
  });
  if (search) {
    params.append('search', search);
  }

  const response = await fetch(
    `${API_URL}/partners/my/memorials?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch memorials');
  }

  return response.json();
}

function MemorialCard({ memorial }: { memorial: Memorial }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {memorial.photoUrl ? (
            <img
              src={memorial.photoUrl}
              alt={`${memorial.firstName} ${memorial.lastName}`}
              className="w-14 h-14 rounded-lg object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
              {getInitials(memorial.firstName, memorial.lastName)}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold truncate">
                  {memorial.firstName} {memorial.lastName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {memorial.birthDate && `${formatDate(memorial.birthDate)} – `}
                  {formatDate(memorial.deathDate)}
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
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${memorial.slug}`} target="_blank">
                      <Eye className="h-4 w-4 mr-2" />
                      View Public Page
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/partner/memorials/${memorial.id}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Location */}
            {memorial.deathPlaceLabel && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {memorial.deathPlaceLabel}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(memorial.createdAt)}
            </span>
            {memorial._count && (
              <span>
                {memorial._count.tributes} tribute
                {memorial._count.tributes !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {memorial.isLocked && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
              <CheckCircle2 className="h-3 w-3" />
              Locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MemorialsPage() {
  const token = useAccessToken();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['partner', 'memorials', token, page, debouncedSearch],
    queryFn: () => fetchMemorials(token!, page, debouncedSearch),
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Memorials</h1>
          <p className="text-muted-foreground mt-1">
            Manage memorial pages for your organization
          </p>
        </div>
        <Button asChild>
          <Link href="/partner/memorials/new">
            <Plus className="h-4 w-4 mr-2" />
            New Memorial
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : data?.profiles.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          {debouncedSearch ? (
            <>
              <h3 className="font-semibold">No results found</h3>
              <p className="text-muted-foreground mt-1">
                No memorials match &quot;{debouncedSearch}&quot;
              </p>
            </>
          ) : (
            <>
              <h3 className="font-semibold">No memorials yet</h3>
              <p className="text-muted-foreground mt-1">
                Create your first memorial to get started
              </p>
              <Button asChild className="mt-4">
                <Link href="/partner/memorials/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Memorial
                </Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.profiles.map((memorial) => (
              <MemorialCard key={memorial.id} memorial={memorial} />
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
    </div>
  );
}

