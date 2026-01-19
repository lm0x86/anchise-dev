'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Building2,
  Church,
  Heart,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

interface PartnersResponse {
  partners: Partner[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const typeIcons = {
  FUNERAL_HOME: Building2,
  CHURCH: Church,
  HOSPITAL: Heart,
  OTHER: Building2,
};

const typeLabels = {
  FUNERAL_HOME: 'Funeral Home',
  CHURCH: 'Church',
  HOSPITAL: 'Hospital',
  OTHER: 'Other',
};

async function fetchPendingRequests(
  token: string,
  page: number
): Promise<PartnersResponse> {
  const response = await fetch(
    `${API_URL}/partners/admin/pending?page=${page}&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch requests');
  }

  return response.json();
}

async function reviewPartner(
  token: string,
  partnerId: string,
  status: 'APPROVED' | 'REJECTED',
  rejectedReason?: string
): Promise<Partner> {
  const response = await fetch(`${API_URL}/partners/admin/${partnerId}/review`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, rejectedReason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to review partner');
  }

  return response.json();
}

function RequestCard({
  partner,
  onApprove,
  onReject,
}: {
  partner: Partner;
  onApprove: () => void;
  onReject: () => void;
}) {
  const Icon = typeIcons[partner.type];

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Icon className="h-6 w-6" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg">{partner.name}</h3>
          <p className="text-sm text-muted-foreground">{typeLabels[partner.type]}</p>
          <p className="text-sm text-muted-foreground mt-1">{partner.contactEmail}</p>
        </div>

        {/* Status Badge */}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <span className="text-sm text-muted-foreground">
          Requested {format(new Date(partner.createdAt), 'PPP')}
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReject}
            className="text-destructive hover:text-destructive"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button size="sm" onClick={onApprove}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PartnerRequestsPage() {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  // Dialogs
  const [rejectPartner, setRejectPartner] = useState<Partner | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'partner-requests', token, page],
    queryFn: () => fetchPendingRequests(token!, page),
    enabled: !!token,
  });

  const approveMutation = useMutation({
    mutationFn: (partnerId: string) => reviewPartner(token!, partnerId, 'APPROVED'),
    onSuccess: (partner) => {
      toast.success(`${partner.name} has been approved!`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'partner-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ partnerId, reason }: { partnerId: string; reason: string }) =>
      reviewPartner(token!, partnerId, 'REJECTED', reason),
    onSuccess: (partner) => {
      toast.success(`${partner.name} has been rejected`);
      setRejectPartner(null);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'partner-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleApprove = (partner: Partner) => {
    approveMutation.mutate(partner.id);
  };

  const handleReject = () => {
    if (rejectPartner && rejectionReason.trim()) {
      rejectMutation.mutate({
        partnerId: rejectPartner.id,
        reason: rejectionReason.trim(),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold">Partner Requests</h1>
        <p className="text-muted-foreground mt-1">
          Review and approve new partner applications
        </p>
      </div>

      {/* Stats */}
      {data && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{data.total}</p>
            <p className="text-sm text-muted-foreground">
              {data.total === 1 ? 'pending request' : 'pending requests'}
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : data?.partners.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No Pending Requests</h3>
          <p className="text-muted-foreground mt-1">
            All partner requests have been reviewed
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data?.partners.map((partner) => (
              <RequestCard
                key={partner.id}
                partner={partner}
                onApprove={() => handleApprove(partner)}
                onReject={() => setRejectPartner(partner)}
              />
            ))}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
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
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Rejection Dialog */}
      <Dialog open={!!rejectPartner} onOpenChange={() => setRejectPartner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Partner Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting{' '}
              <strong>{rejectPartner?.name}</strong>. This will be shared with
              the applicant.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Rejection Reason</Label>
            <Textarea
              id="reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Unable to verify organization, incomplete information..."
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectPartner(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

