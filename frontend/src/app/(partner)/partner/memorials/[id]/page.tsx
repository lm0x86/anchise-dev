'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Calendar,
  User,
  FileText,
  Eye,
  Trash2,
  Lock,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Memorial {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  deathDate: string;
  sex: 'MALE' | 'FEMALE' | null;
  deathPlaceLabel: string | null;
  obituary: string | null;
  photoUrl: string | null;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

const memorialSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  birthDate: z.string().optional(),
  deathDate: z.string().min(1, 'Date of passing is required'),
  sex: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  deathPlaceLabel: z.string().optional(),
  obituary: z.string().max(5000).optional(),
});

type MemorialFormData = z.infer<typeof memorialSchema>;

async function fetchMemorial(token: string, id: string): Promise<Memorial> {
  const response = await fetch(`${API_URL}/partners/my/memorials/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch memorial');
  }

  return response.json();
}

async function updateMemorial(
  token: string,
  id: string,
  data: MemorialFormData & { photoUrl?: string }
): Promise<Memorial> {
  const response = await fetch(`${API_URL}/partners/my/memorials/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...data,
      sex: data.sex || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update memorial');
  }

  return response.json();
}

async function uploadProfilePhoto(
  token: string,
  profileId: string,
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/uploads/profile/${profileId}/photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload photo');
  }

  const result = await response.json();
  return result.url;
}

async function deleteMemorial(token: string, id: string): Promise<void> {
  const response = await fetch(`${API_URL}/partners/my/memorials/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete memorial');
  }
}

export default function EditMemorialPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAccessToken();
  const id = params.id as string;
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { data: memorial, isLoading } = useQuery({
    queryKey: ['partner', 'memorial', id, token],
    queryFn: () => fetchMemorial(token!, id),
    enabled: !!token && !!id,
  });

  // Sync photo URL with memorial data
  useEffect(() => {
    if (memorial) {
      setPhotoUrl(memorial.photoUrl);
    }
  }, [memorial]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<MemorialFormData>({
    resolver: zodResolver(memorialSchema),
    values: memorial
      ? {
          firstName: memorial.firstName,
          lastName: memorial.lastName,
          birthDate: memorial.birthDate?.split('T')[0] || '',
          deathDate: memorial.deathDate.split('T')[0],
          sex: memorial.sex,
          deathPlaceLabel: memorial.deathPlaceLabel || '',
          obituary: memorial.obituary || '',
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: MemorialFormData) => updateMemorial(token!, id, data),
    onSuccess: () => {
      toast.success('Memorial updated successfully');
      queryClient.invalidateQueries({ queryKey: ['partner', 'memorial', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMemorial(token!, id),
    onSuccess: () => {
      toast.success('Memorial deleted');
      router.push('/partner/memorials');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: MemorialFormData) => {
    updateMutation.mutate(data);
  };

  const handlePhotoUpload = async (file: File): Promise<string> => {
    const url = await uploadProfilePhoto(token!, id, file);
    // Update memorial with new photo URL
    await updateMemorial(token!, id, { 
      firstName: memorial!.firstName,
      lastName: memorial!.lastName,
      deathDate: memorial!.deathDate.split('T')[0],
      photoUrl: url 
    } as any);
    queryClient.invalidateQueries({ queryKey: ['partner', 'memorial', id] });
    return url;
  };

  const sex = watch('sex');

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!memorial) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Memorial not found</h2>
        <Button asChild className="mt-4">
          <Link href="/partner/memorials">Back to Memorials</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/partner/memorials"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Memorials
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-serif font-semibold">Edit Memorial</h1>
            <p className="text-muted-foreground mt-1">
              {memorial.firstName} {memorial.lastName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/profile/${memorial.slug}`} target="_blank">
                <Eye className="h-4 w-4 mr-2" />
                View Public Page
              </Link>
            </Button>
          </div>
        </div>

        {memorial.isLocked && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2 text-sm text-yellow-600">
            <Lock className="h-4 w-4" />
            This memorial is locked and cannot be edited
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Identity Section */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Identity</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                {...register('firstName')}
                disabled={memorial.isLocked}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                {...register('lastName')}
                disabled={memorial.isLocked}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sex">Sex</Label>
              <Select
                value={sex || ''}
                onValueChange={(value) =>
                  setValue('sex', value as 'MALE' | 'FEMALE', {
                    shouldDirty: true,
                  })
                }
                disabled={memorial.isLocked}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Dates Section */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Dates</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthDate">Date of Birth</Label>
              <Input
                id="birthDate"
                type="date"
                {...register('birthDate')}
                disabled={memorial.isLocked}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deathDate">Date of Passing *</Label>
              <Input
                id="deathDate"
                type="date"
                {...register('deathDate')}
                disabled={memorial.isLocked}
              />
              {errors.deathDate && (
                <p className="text-sm text-destructive">
                  {errors.deathDate.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Location</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deathPlaceLabel">Place of Passing</Label>
            <Input
              id="deathPlaceLabel"
              {...register('deathPlaceLabel')}
              disabled={memorial.isLocked}
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Content</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Photo</Label>
              <ImageUpload
                value={photoUrl}
                onChange={(url) => setPhotoUrl(url)}
                onUpload={handlePhotoUpload}
                disabled={memorial.isLocked}
                aspectRatio="auto"
                placeholder="Upload photo"
                className="max-w-[300px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="obituary">Obituary</Label>
              <Textarea
                id="obituary"
                {...register('obituary')}
                rows={6}
                disabled={memorial.isLocked}
              />
              {errors.obituary && (
                <p className="text-sm text-destructive">
                  {errors.obituary.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={memorial.isLocked || deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Memorial?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  memorial page for {memorial.firstName} {memorial.lastName}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              disabled={!isDirty || memorial.isLocked}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={
                !isDirty || memorial.isLocked || updateMutation.isPending
              }
            >
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

