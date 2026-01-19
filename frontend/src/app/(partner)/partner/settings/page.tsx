'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Building2,
  Mail,
  Globe,
  Image,
  Loader2,
  CheckCircle2,
  Save,
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface PartnerInfo {
  id: string;
  name: string;
  slug: string;
  type: 'FUNERAL_HOME' | 'CHURCH' | 'HOSPITAL' | 'OTHER';
  contactEmail: string;
  logoUrl: string | null;
  verified: boolean;
  createdAt: string;
}

const settingsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  contactEmail: z.string().email('Invalid email address'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

async function fetchPartnerInfo(token: string): Promise<PartnerInfo> {
  const response = await fetch(`${API_URL}/partners/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch partner info');
  }

  return response.json();
}

async function updatePartner(
  token: string,
  data: SettingsFormData & { logoUrl?: string }
): Promise<PartnerInfo> {
  const response = await fetch(`${API_URL}/partners/my`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...data,
      logoUrl: data.logoUrl || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update settings');
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

const partnerTypeLabels = {
  FUNERAL_HOME: 'Funeral Home',
  CHURCH: 'Church',
  HOSPITAL: 'Hospital',
  OTHER: 'Other',
};

export default function PartnerSettingsPage() {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const { data: partner, isLoading } = useQuery({
    queryKey: ['partner', 'info', token],
    queryFn: () => fetchPartnerInfo(token!),
    enabled: !!token,
  });

  // Sync logo URL with partner data
  useEffect(() => {
    if (partner) {
      setLogoUrl(partner.logoUrl);
    }
  }, [partner]);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    values: partner
      ? {
          name: partner.name,
          contactEmail: partner.contactEmail,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: SettingsFormData) => updatePartner(token!, data),
    onSuccess: () => {
      toast.success('Settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['partner', 'info'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    updateMutation.mutate(data);
  };

  const handleLogoUpload = async (file: File): Promise<string> => {
    if (!partner) throw new Error('Partner not loaded');
    const url = await uploadPartnerLogo(token!, partner.id, file);
    // Update partner with new logo URL
    await updatePartner(token!, { ...{ name: partner.name, contactEmail: partner.contactEmail }, logoUrl: url });
    queryClient.invalidateQueries({ queryKey: ['partner', 'info'] });
    return url;
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Partner not found</h2>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization&apos;s profile and settings
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {partner.logoUrl ? (
              <img
                src={partner.logoUrl}
                alt={partner.name}
                className="w-16 h-16 rounded-xl object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-semibold">
                {partner.name[0]}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold">{partner.name}</h2>
              <p className="text-sm text-muted-foreground">
                {partnerTypeLabels[partner.type]}
              </p>
            </div>
          </div>

          {partner.verified ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/10 text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-500/10 text-yellow-500">
              Pending Verification
            </span>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Organization Info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Organization Info</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Organization Type</Label>
              <Input
                value={partnerTypeLabels[partner.type]}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Contact support to change your organization type
              </p>
            </div>

            <div className="space-y-2">
              <Label>Public URL</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span>anchise.com/partner/{partner.slug}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Contact Info</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input id="contactEmail" type="email" {...register('contactEmail')} />
            {errors.contactEmail && (
              <p className="text-sm text-destructive">
                {errors.contactEmail.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              This email will be displayed on your public profile
            </p>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Image className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Branding</h2>
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <ImageUpload
              value={logoUrl}
              onChange={(url) => setLogoUrl(url)}
              onUpload={handleLogoUpload}
              aspectRatio="square"
              placeholder="Upload logo"
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Your logo will appear on memorial pages and in the partner directory
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="submit"
            disabled={!isDirty || updateMutation.isPending}
          >
            {updateMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}

