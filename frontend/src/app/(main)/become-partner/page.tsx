'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Church,
  Heart,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { useAccessToken, useUser } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const requestSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(200),
  type: z.enum(['FUNERAL_HOME', 'CHURCH', 'HOSPITAL', 'OTHER']),
  description: z.string().max(1000).optional(),
});

type RequestForm = z.infer<typeof requestSchema>;

interface Partner {
  id: string;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectedReason?: string | null;
  createdAt: string;
}

const partnerTypes = [
  { value: 'FUNERAL_HOME', label: 'Funeral Home', icon: Building2 },
  { value: 'CHURCH', label: 'Church', icon: Church },
  { value: 'HOSPITAL', label: 'Hospital', icon: Heart },
  { value: 'OTHER', label: 'Other', icon: Building2 },
];

async function checkExistingPartner(token: string): Promise<Partner | null> {
  try {
    const response = await fetch(`${API_URL}/partners/my`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

async function requestPartner(token: string, data: RequestForm): Promise<Partner> {
  const response = await fetch(`${API_URL}/partners/request`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to submit request');
  }

  return response.json();
}

function ExistingPartnerStatus({ partner }: { partner: Partner }) {
  return (
    <div className="max-w-md mx-auto text-center">
      {partner.status === 'PENDING' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-8">
          <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-semibold mb-2">
            Request Pending
          </h2>
          <p className="text-muted-foreground mb-4">
            Your request to become a partner as <strong>{partner.name}</strong> is
            pending review. We&apos;ll notify you once it&apos;s been reviewed.
          </p>
          <p className="text-sm text-muted-foreground">
            Submitted on {new Date(partner.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {partner.status === 'APPROVED' && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-semibold mb-2">
            You&apos;re Already a Partner!
          </h2>
          <p className="text-muted-foreground mb-6">
            Your partner organization <strong>{partner.name}</strong> is active.
          </p>
          <Link href="/partner">
            <Button>Go to Partner Portal</Button>
          </Link>
        </div>
      )}

      {partner.status === 'REJECTED' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-semibold mb-2">
            Request Declined
          </h2>
          <p className="text-muted-foreground mb-4">
            Your request for <strong>{partner.name}</strong> was not approved.
          </p>
          {partner.rejectedReason && (
            <div className="bg-background/50 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium mb-1">Reason:</p>
              <p className="text-sm text-muted-foreground">{partner.rejectedReason}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            If you believe this was in error, please contact support.
          </p>
        </div>
      )}
    </div>
  );
}

export default function BecomePartnerPage() {
  const token = useAccessToken();
  const user = useUser();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string>('');
  const [submittedPartner, setSubmittedPartner] = useState<Partner | null>(null);

  const { data: existingPartner, isLoading: checkingPartner } = useQuery({
    queryKey: ['my-partner', token],
    queryFn: () => checkExistingPartner(token!),
    enabled: !!token,
  });

  const form = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      name: '',
      type: 'FUNERAL_HOME',
      description: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: RequestForm) => requestPartner(token!, data),
    onSuccess: (partner) => {
      setSubmittedPartner(partner);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: RequestForm) => {
    mutation.mutate(data);
  };

  // Show confirmation screen after successful submission
  if (submittedPartner) {
    return (
      <div className="container mx-auto px-5 py-12 max-w-lg text-center">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-serif font-semibold mb-3">
            Request Submitted!
          </h1>
          <p className="text-muted-foreground mb-6">
            Your request to become a partner as <strong>{submittedPartner.name}</strong> has been submitted successfully. Our team will review it shortly.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            You&apos;ll receive a notification once your request has been reviewed. This usually takes 1-2 business days.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/board">
              <Button>Go to Board</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <div className="container mx-auto px-5 py-12 max-w-2xl text-center">
        <Building2 className="h-16 w-16 text-primary mx-auto mb-6" />
        <h1 className="text-3xl font-serif font-semibold mb-4">Become a Partner</h1>
        <p className="text-muted-foreground mb-8">
          You need to be logged in to become a partner.
        </p>
        <Link href="/login?redirect=/become-partner">
          <Button>Sign In to Continue</Button>
        </Link>
      </div>
    );
  }

  if (checkingPartner) {
    return (
      <div className="container mx-auto px-5 py-12 max-w-2xl text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-muted-foreground mt-4">Loading...</p>
      </div>
    );
  }

  if (existingPartner) {
    return (
      <div className="container mx-auto px-5 py-12">
        <ExistingPartnerStatus partner={existingPartner} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-5 py-12 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-10">
        <Building2 className="h-16 w-16 text-primary mx-auto mb-6" />
        <h1 className="text-3xl font-serif font-semibold mb-4">
          Become a Partner
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Join our network of funeral homes, churches, and organizations to create
          and manage memorial pages for the families you serve.
        </p>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          { title: 'Create Memorials', description: 'Publish beautiful memorial pages' },
          { title: 'Manage Tributes', description: 'Moderate community tributes' },
          { title: 'Verified Badge', description: 'Build trust with families' },
        ].map((benefit, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 text-center">
            <h3 className="font-medium mb-1">{benefit.title}</h3>
            <p className="text-sm text-muted-foreground">{benefit.description}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-6">Request Partner Access</h2>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Organization Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="e.g., Pompes Funèbres Générales"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Organization Type */}
          <div className="space-y-2">
            <Label>Organization Type *</Label>
            <div className="grid grid-cols-2 gap-3">
              {partnerTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      setSelectedType(type.value);
                      form.setValue('type', type.value as RequestForm['type']);
                    }}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left',
                      selectedType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description (optional) */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Tell us about your organization (optional)
            </Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Brief description of your organization and how you plan to use the platform..."
              rows={4}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          {/* Contact Email (from user) */}
          <div className="space-y-2">
            <Label>Contact Email</Label>
            <Input value={user.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              We&apos;ll use your account email for communication
            </p>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending || !selectedType}
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Submit Request
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Your request will be reviewed by our team. This usually takes 1-2 business days.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

