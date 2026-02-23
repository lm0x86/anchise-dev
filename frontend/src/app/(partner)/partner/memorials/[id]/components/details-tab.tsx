'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  User,
  Calendar,
  FileText,
  Save,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { LocationPicker, type LocationValue } from '@/components/ui/location-picker';
import { uploadProfilePhoto } from '@/lib/upload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  pinLat: number | null;
  pinLng: number | null;
  obituary: string | null;
  bio: string | null;
  epitaph: string | null;
  personalityNotes: string | null;
  photoUrl: string | null;
  coverPhotoUrl: string | null;
  isLocked: boolean;
}

const schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  birthDate: z.string().optional(),
  deathDate: z.string().min(1, 'Date of passing is required'),
  sex: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  deathPlaceLabel: z.string().optional(),
  pinLat: z.number().optional().nullable(),
  pinLng: z.number().optional().nullable(),
  obituary: z.string().max(5000).optional(),
  bio: z.string().max(500).optional(),
  epitaph: z.string().max(300).optional(),
  personalityNotes: z.string().max(5000).optional(),
});

type FormData = z.infer<typeof schema>;

async function updateMemorial(
  token: string,
  id: string,
  data: FormData & { photoUrl?: string },
) {
  const res = await fetch(`${API_URL}/partners/my/memorials/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, sex: data.sex || undefined }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to update memorial');
  }
  return res.json();
}

function CharCount({ value, max }: { value?: string; max: number }) {
  const len = value?.length || 0;
  const isNear = len > max * 0.9;
  const isOver = len >= max;
  return (
    <span className={`text-xs ${isOver ? 'text-destructive' : isNear ? 'text-yellow-500' : 'text-muted-foreground'}`}>
      {len}/{max}
    </span>
  );
}

interface DetailsTabProps {
  memorial: Memorial;
  token: string;
}

export function DetailsTab({ memorial, token }: DetailsTabProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      firstName: memorial.firstName,
      lastName: memorial.lastName,
      birthDate: memorial.birthDate?.split('T')[0] || '',
      deathDate: memorial.deathDate.split('T')[0],
      sex: memorial.sex,
      deathPlaceLabel: memorial.deathPlaceLabel || '',
      pinLat: memorial.pinLat,
      pinLng: memorial.pinLng,
      obituary: memorial.obituary || '',
      bio: memorial.bio || '',
      epitaph: memorial.epitaph || '',
      personalityNotes: memorial.personalityNotes || '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => updateMemorial(token, memorial.id, data),
    onSuccess: () => {
      toast.success('Memorial updated');
      queryClient.invalidateQueries({ queryKey: ['partner', 'memorial', memorial.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePhotoUpload = async (file: File) => {
    const url = await uploadProfilePhoto(token, memorial.id, file);
    await updateMemorial(token, memorial.id, {
      firstName: memorial.firstName,
      lastName: memorial.lastName,
      deathDate: memorial.deathDate.split('T')[0],
      photoUrl: url,
    } as any);
    queryClient.invalidateQueries({ queryKey: ['partner', 'memorial', memorial.id] });
    return url;
  };

  const sex = watch('sex');

  return (
    <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-8">
      {/* Identity */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Identity</h2>
        </div>
        <div className="space-y-10">
          <div className="flex flex-col items-center">
            <Label className="mb-2 block">Photo</Label>
            <ImageUpload
              value={memorial.photoUrl}
              onChange={async (url) => {
                if (url === null) {
                  try {
                    await updateMemorial(token, memorial.id, {
                      firstName: memorial.firstName,
                      lastName: memorial.lastName,
                      deathDate: memorial.deathDate.split('T')[0],
                      photoUrl: null,
                    } as any);
                    queryClient.invalidateQueries({ queryKey: ['partner', 'memorial', memorial.id] });
                    toast.success('Photo removed');
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to remove photo');
                  }
                }
              }}
              onUpload={handlePhotoUpload}
              disabled={memorial.isLocked}
              aspectRatio="square"
              placeholder="Upload photo"
              className="w-[140px] h-[140px]"
              enableCrop
              cropShape="round"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" {...register('firstName')} disabled={memorial.isLocked} />
              {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" {...register('lastName')} disabled={memorial.isLocked} />
              {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">Sex</Label>
              <Select
                value={sex || ''}
                onValueChange={(v) => setValue('sex', v as 'MALE' | 'FEMALE', { shouldDirty: true })}
                disabled={memorial.isLocked}
              >
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Dates</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="birthDate">Date of Birth</Label>
            <Input id="birthDate" type="date" {...register('birthDate')} disabled={memorial.isLocked} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deathDate">Date of Passing *</Label>
            <Input id="deathDate" type="date" {...register('deathDate')} disabled={memorial.isLocked} />
            {errors.deathDate && <p className="text-sm text-destructive">{errors.deathDate.message}</p>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Content</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="epitaph">Epitaph</Label>
            <Input
              id="epitaph"
              {...register('epitaph')}
              disabled={memorial.isLocked}
              placeholder="A short memorial phrase..."
              maxLength={300}
            />
            <div className="flex justify-between">
              <p className="text-xs text-muted-foreground">Displayed under the name on the public profile</p>
              <CharCount value={watch('epitaph')} max={300} />
            </div>
            {errors.epitaph && <p className="text-sm text-destructive">{errors.epitaph.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Short Bio</Label>
            <Textarea
              id="bio"
              {...register('bio')}
              rows={3}
              disabled={memorial.isLocked}
              placeholder="A brief description of who they were..."
              maxLength={500}
            />
            <div className="flex justify-end">
              <CharCount value={watch('bio')} max={500} />
            </div>
            {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="obituary">Obituary</Label>
            <Textarea id="obituary" {...register('obituary')} rows={6} disabled={memorial.isLocked} maxLength={5000} />
            <div className="flex justify-end">
              <CharCount value={watch('obituary')} max={5000} />
            </div>
            {errors.obituary && <p className="text-sm text-destructive">{errors.obituary.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="personalityNotes">Personality Notes</Label>
            <Textarea
              id="personalityNotes"
              {...register('personalityNotes')}
              rows={4}
              disabled={memorial.isLocked}
              placeholder="What made them unique, their traits, habits..."
              maxLength={5000}
            />
            <div className="flex justify-end">
              <CharCount value={watch('personalityNotes')} max={5000} />
            </div>
            {errors.personalityNotes && <p className="text-sm text-destructive">{errors.personalityNotes.message}</p>}
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="bg-card border border-border rounded-xl p-6">
        <LocationPicker
          value={{
            label: watch('deathPlaceLabel') || '',
            lat: watch('pinLat') ?? null,
            lng: watch('pinLng') ?? null,
          }}
          onChange={(loc: LocationValue) => {
            setValue('deathPlaceLabel', loc.label, { shouldDirty: true });
            setValue('pinLat', loc.lat, { shouldDirty: true });
            setValue('pinLng', loc.lng, { shouldDirty: true });
          }}
          disabled={memorial.isLocked}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => reset()} disabled={!isDirty || memorial.isLocked}>
          Reset
        </Button>
        <Button type="submit" disabled={!isDirty || memorial.isLocked || updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </form>
  );
}
