'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
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
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const memorialSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  birthDate: z.string().optional(),
  deathDate: z.string().min(1, 'Date of passing is required'),
  sex: z.enum(['MALE', 'FEMALE']).optional(),
  deathPlaceLabel: z.string().optional(),
  obituary: z.string().max(5000).optional(),
});

type MemorialFormData = z.infer<typeof memorialSchema>;

async function createMemorial(
  token: string,
  data: MemorialFormData
): Promise<{ id: string; slug: string }> {
  const response = await fetch(`${API_URL}/partners/my/memorials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create memorial');
  }

  return response.json();
}

export default function NewMemorialPage() {
  const router = useRouter();
  const token = useAccessToken();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MemorialFormData>({
    resolver: zodResolver(memorialSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      deathDate: '',
      obituary: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: MemorialFormData) => createMemorial(token!, data),
    onSuccess: (result) => {
      toast.success('Memorial created successfully');
      router.push(`/partner/memorials/${result.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: MemorialFormData) => {
    createMutation.mutate(data);
  };

  const sex = watch('sex');

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
        <h1 className="text-2xl font-serif font-semibold">Create Memorial</h1>
        <p className="text-muted-foreground mt-1">
          Create a new memorial page for a deceased person
        </p>
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
                placeholder="Jean"
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
                placeholder="Dupont"
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
                value={sex}
                onValueChange={(value) =>
                  setValue('sex', value as 'MALE' | 'FEMALE')
                }
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
              <Input id="birthDate" type="date" {...register('birthDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deathDate">Date of Passing *</Label>
              <Input id="deathDate" type="date" {...register('deathDate')} />
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
              placeholder="Paris, France"
            />
            <p className="text-xs text-muted-foreground">
              Enter the city or location where the person passed away
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Content</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-accent/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 You can upload a photo after creating the memorial by editing it.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obituary">Obituary</Label>
              <Textarea
                id="obituary"
                {...register('obituary')}
                placeholder="Share memories and celebrate their life..."
                rows={6}
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
        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/partner/memorials">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Create Memorial
          </Button>
        </div>
      </form>
    </div>
  );
}

