'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Eye,
  Trash2,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { DetailsTab } from './components/details-tab';
import { HighlightsTab } from './components/highlights-tab';
import { LegacyTab } from './components/legacy-tab';

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
  createdAt: string;
  updatedAt: string;
}

async function fetchMemorial(token: string, id: string): Promise<Memorial> {
  const res = await fetch(`${API_URL}/partners/my/memorials/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch memorial');
  return res.json();
}

async function deleteMemorial(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/partners/my/memorials/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to delete memorial');
  }
}

export default function EditMemorialPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAccessToken();
  const id = params.id as string;

  const { data: memorial, isLoading } = useQuery({
    queryKey: ['partner', 'memorial', id, token],
    queryFn: () => fetchMemorial(token!, id),
    enabled: !!token && !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMemorial(token!, id),
    onSuccess: () => {
      toast.success('Memorial deleted');
      router.push('/partner/memorials');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
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
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
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
                View
              </Link>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={memorial.isLocked || deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
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
                    {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {memorial.isLocked && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2 text-sm text-yellow-600">
            <Lock className="h-4 w-4" />
            This memorial is locked and cannot be edited
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="w-full grid grid-cols-3 mb-6">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="highlights">Highlights</TabsTrigger>
          <TabsTrigger value="legacy">Legacy</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <DetailsTab memorial={memorial} token={token!} />
        </TabsContent>

        <TabsContent value="highlights">
          <HighlightsTab profileId={memorial.id} token={token!} isLocked={memorial.isLocked} birthDate={memorial.birthDate} deathDate={memorial.deathDate} />
        </TabsContent>

        <TabsContent value="legacy">
          <LegacyTab profileId={memorial.id} token={token!} isLocked={memorial.isLocked} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
