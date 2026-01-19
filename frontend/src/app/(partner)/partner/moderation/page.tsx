'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  User,
  Loader2,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Tribute {
  id: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'HIDDEN' | 'REMOVED';
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  profile: {
    id: string;
    slug: string;
    firstName: string;
    lastName: string;
  };
}

interface TributesResponse {
  tributes: Tribute[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function fetchTributes(
  token: string,
  status?: string,
  page: number = 1
): Promise<TributesResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '20',
  });
  if (status && status !== 'ALL') {
    params.append('status', status);
  }

  const response = await fetch(
    `${API_URL}/partners/my/tributes?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch tributes');
  }

  return response.json();
}

async function moderateTribute(
  token: string,
  tributeId: string,
  status: 'APPROVED' | 'HIDDEN' | 'REMOVED'
): Promise<void> {
  const response = await fetch(`${API_URL}/tributes/${tributeId}/moderate`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to moderate tribute');
  }
}

function StatusBadge({ status }: { status: Tribute['status'] }) {
  const config = {
    PENDING: {
      icon: Clock,
      label: 'Pending',
      className: 'bg-yellow-500/10 text-yellow-500',
    },
    APPROVED: {
      icon: CheckCircle2,
      label: 'Approved',
      className: 'bg-green-500/10 text-green-500',
    },
    HIDDEN: {
      icon: XCircle,
      label: 'Hidden',
      className: 'bg-orange-500/10 text-orange-500',
    },
    REMOVED: {
      icon: XCircle,
      label: 'Removed',
      className: 'bg-red-500/10 text-red-500',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function TributeCard({
  tribute,
  onModerate,
  isLoading,
}: {
  tribute: Tribute;
  onModerate: (status: 'APPROVED' | 'HIDDEN' | 'REMOVED') => void;
  isLoading: boolean;
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
            {tribute.author.firstName[0]}
            {tribute.author.lastName[0]}
          </div>
          <div>
            <p className="font-medium">
              {tribute.author.firstName} {tribute.author.lastName}
            </p>
            <p className="text-sm text-muted-foreground">
              {tribute.author.email}
            </p>
          </div>
        </div>
        <StatusBadge status={tribute.status} />
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm whitespace-pre-wrap">{tribute.content}</p>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-accent/30 border-t border-border flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            On{' '}
            <Link
              href={`/profile/${tribute.profile.slug}`}
              className="text-primary hover:underline"
              target="_blank"
            >
              {tribute.profile.firstName} {tribute.profile.lastName}
            </Link>
          </span>
          <span className="text-xs">{formatDate(tribute.createdAt)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {tribute.status === 'PENDING' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onModerate('HIDDEN')}
                disabled={isLoading}
              >
                Hide
              </Button>
              <Button
                size="sm"
                onClick={() => onModerate('APPROVED')}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </>
                )}
              </Button>
            </>
          )}
          {tribute.status === 'APPROVED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onModerate('HIDDEN')}
              disabled={isLoading}
            >
              Hide
            </Button>
          )}
          {tribute.status === 'HIDDEN' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onModerate('APPROVED')}
              disabled={isLoading}
            >
              Restore
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ModerationPage() {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [page, setPage] = useState(1);
  const [loadingTributeId, setLoadingTributeId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['partner', 'tributes', token, statusFilter, page],
    queryFn: () => fetchTributes(token!, statusFilter, page),
    enabled: !!token,
  });

  const moderateMutation = useMutation({
    mutationFn: ({
      tributeId,
      status,
    }: {
      tributeId: string;
      status: 'APPROVED' | 'HIDDEN' | 'REMOVED';
    }) => moderateTribute(token!, tributeId, status),
    onMutate: ({ tributeId }) => {
      setLoadingTributeId(tributeId);
    },
    onSuccess: (_, { status }) => {
      toast.success(
        status === 'APPROVED'
          ? 'Tribute approved'
          : status === 'HIDDEN'
          ? 'Tribute hidden'
          : 'Tribute removed'
      );
      queryClient.invalidateQueries({ queryKey: ['partner', 'tributes'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setLoadingTributeId(null);
    },
  });

  const handleModerate = (
    tributeId: string,
    status: 'APPROVED' | 'HIDDEN' | 'REMOVED'
  ) => {
    moderateMutation.mutate({ tributeId, status });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Moderation</h1>
          <p className="text-muted-foreground mt-1">
            Review and moderate tributes on your memorials
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="HIDDEN">Hidden</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : data?.tributes.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          {statusFilter === 'PENDING' ? (
            <>
              <h3 className="font-semibold">All caught up!</h3>
              <p className="text-muted-foreground mt-1">
                No tributes pending moderation
              </p>
            </>
          ) : (
            <>
              <h3 className="font-semibold">No tributes found</h3>
              <p className="text-muted-foreground mt-1">
                No tributes match the selected filter
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data?.tributes.map((tribute) => (
              <TributeCard
                key={tribute.id}
                tribute={tribute}
                onModerate={(status) => handleModerate(tribute.id, status)}
                isLoading={loadingTributeId === tribute.id}
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
    </div>
  );
}

