'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Star,
  Clock,
  Heart,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Lightbox } from '@/components/ui/lightbox';
import { uploadFile } from '@/lib/upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  timelineApi,
  valuesApi,
  mediaApi,
  type TimelineEvent,
  type ProfileValue,
  type MediaItem,
} from '@/lib/memorial-content-api';

interface HighlightsTabProps {
  profileId: string;
  token: string;
  isLocked: boolean;
  birthDate?: string | null;
  deathDate: string;
}

// ============================================
// Timeline Events Section
// ============================================

function TimelineSection({ profileId, token, isLocked, birthDate, deathDate }: HighlightsTabProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', date: '', endDate: '', isFeatured: false });

  const { data: events = [] } = useQuery({
    queryKey: ['memorial-content', profileId, 'timeline'],
    queryFn: () => timelineApi.list(token, profileId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['memorial-content', profileId, 'timeline'] });

  function cleanForCreate(data: typeof form) {
    return {
      ...data,
      description: data.description || undefined,
      endDate: data.endDate || undefined,
    };
  }

  function cleanForUpdate(data: typeof form) {
    return {
      ...data,
      description: data.description || null,
      endDate: data.endDate || null,
    };
  }

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => timelineApi.create(token, profileId, cleanForCreate(data)),
    onSuccess: () => { invalidate(); setShowForm(false); resetForm(); toast.success('Event added'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) => timelineApi.update(token, profileId, id, cleanForUpdate(data)),
    onSuccess: () => { invalidate(); setEditingId(null); resetForm(); toast.success('Event updated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => timelineApi.delete(token, profileId, id),
    onSuccess: () => { invalidate(); toast.success('Event deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      timelineApi.update(token, profileId, id, { isFeatured }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ title: '', description: '', date: '', endDate: '', isFeatured: false });
  }

  function startEdit(e: TimelineEvent) {
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description || '',
      date: e.date?.split('T')[0] || '',
      endDate: e.endDate?.split('T')[0] || '',
      isFeatured: e.isFeatured,
    });
    setShowForm(false);
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Timeline Events</h2>
          <span className="text-xs text-muted-foreground">({events.length})</span>
        </div>
        {!isLocked && !showForm && (
          <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {(showForm || editingId) && (
        <div className="border border-border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Graduated University" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Started at *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ended <span className="text-muted-foreground">(optional)</span></Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!form.title || !form.date || isSubmitting}
              onClick={() => editingId
                ? updateMutation.mutate({ id: editingId, data: form })
                : createMutation.mutate(form)
              }
            >
              {isSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <Check className="h-3 w-3 mr-1" /> {editingId ? 'Update' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {events.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">No timeline events yet</p>
      )}

      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3 min-w-0">
              <button
                type="button"
                className="shrink-0 mt-0.5 transition-colors disabled:opacity-50"
                disabled={isLocked || toggleFeaturedMutation.isPending}
                onClick={() => toggleFeaturedMutation.mutate({ id: e.id, isFeatured: !e.isFeatured })}
                title={e.isFeatured ? 'Remove from highlights' : 'Add to highlights'}
              >
                <Star className={`h-4 w-4 ${e.isFeatured ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
              </button>
              <div className="min-w-0">
                <span className="font-medium text-sm">{e.title}</span>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.date).getFullYear()}
                  {e.endDate && ` – ${new Date(e.endDate).getFullYear()}`}
                </p>
                {e.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.description}</p>}
              </div>
            </div>
            {!isLocked && (
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(e)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteMutation.mutate(e.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <TimelinePreview events={events} birthDate={birthDate} deathDate={deathDate} />
    </div>
  );
}

// ============================================
// Timeline Preview
// ============================================

function TimelinePreview({
  events,
  birthDate,
  deathDate,
}: {
  events: TimelineEvent[];
  birthDate?: string | null;
  deathDate: string;
}) {
  const featured = events
    .filter((e) => e.isFeatured)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const birthYear = birthDate ? new Date(birthDate).getFullYear() : null;
  const deathYear = new Date(deathDate).getFullYear();

  const allPoints: { year: number; label: string }[] = [];
  if (birthYear) allPoints.push({ year: birthYear, label: 'Born' });
  featured.forEach((e) => allPoints.push({ year: new Date(e.date).getFullYear(), label: e.title }));
  allPoints.push({ year: deathYear, label: 'Rest in peace' });

  if (allPoints.length < 2) return null;

  return (
    <div className="mt-6 bg-muted/30 border border-border rounded-xl p-5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] text-center mb-6 font-medium">
        Highlights of a Lifetime
      </p>
      <div className="relative mx-4">
        <div className="absolute top-[5px] left-0 right-0 h-px bg-border" />
        <div className="flex justify-between relative">
          {allPoints.map((point, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <div className="w-[10px] h-[10px] rounded-full bg-primary border-2 border-primary shrink-0" />
              <span className="text-[11px] font-semibold text-primary mt-2">{point.year}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 max-w-[70px] text-center leading-tight line-clamp-2">
                {point.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Values Section
// ============================================

function ValuesSection({ profileId, token, isLocked }: HighlightsTabProps) {
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState('');

  const { data: values = [] } = useQuery({
    queryKey: ['memorial-content', profileId, 'values'],
    queryFn: () => valuesApi.list(token, profileId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['memorial-content', profileId, 'values'] });

  const createMutation = useMutation({
    mutationFn: (value: string) => valuesApi.create(token, profileId, { value }),
    onSuccess: () => { invalidate(); setNewValue(''); toast.success('Value added'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => valuesApi.delete(token, profileId, id),
    onSuccess: () => { invalidate(); toast.success('Value removed'); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Values</h2>
        <span className="text-xs text-muted-foreground">({values.length})</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {values.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm border border-primary/20"
          >
            {v.value}
            {!isLocked && (
              <button
                onClick={() => deleteMutation.mutate(v.id)}
                className="ml-1 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {values.length === 0 && (
          <p className="text-sm text-muted-foreground">No values yet</p>
        )}
      </div>

      {!isLocked && (
        <div className="flex gap-2">
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="e.g. Family first, Integrity..."
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newValue.trim()) {
                e.preventDefault();
                createMutation.mutate(newValue.trim());
              }
            }}
          />
          <Button
            size="sm"
            disabled={!newValue.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate(newValue.trim())}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Photos Section
// ============================================

function PhotosSection({ profileId, token, isLocked }: HighlightsTabProps) {
  const queryClient = useQueryClient();
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: photos = [] } = useQuery({
    queryKey: ['memorial-content', profileId, 'media'],
    queryFn: () => mediaApi.list(token, profileId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['memorial-content', profileId, 'media'] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mediaApi.delete(token, profileId, id),
    onSuccess: () => { invalidate(); toast.success('Photo removed'); },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Please select image files');
      return;
    }
    setUploadingCount(imageFiles.length);
    let uploaded = 0;
    try {
      for (const file of imageFiles) {
        const url = await uploadFile(token, file);
        await mediaApi.create(token, profileId, { url, type: 'IMAGE', caption: '' });
        uploaded++;
        setUploadingCount(imageFiles.length - uploaded);
        invalidate();
      }
      toast.success(`${imageFiles.length} photo${imageFiles.length > 1 ? 's' : ''} uploaded`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingCount(0);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (!isLocked && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  const isUploading = uploadingCount > 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Featured Photos</h2>
          <span className="text-xs text-muted-foreground">({photos.length})</span>
        </div>
      </div>

      {!isLocked && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 mb-4 text-center cursor-pointer transition-colors ${
            isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
          } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
          />
          <div className="flex flex-col items-center gap-2">
            <Plus className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag & drop photos or <span className="text-primary underline">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">Supports multiple files</p>
          </div>
        </div>
      )}

      {photos.length === 0 && !isUploading && (
        <p className="text-sm text-muted-foreground text-center py-4">No featured photos yet</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((p) => (
          <div key={p.id} className="relative group rounded-lg overflow-hidden border border-border">
            <img
              src={p.url}
              alt={p.caption || ''}
              className="w-full h-32 object-cover cursor-pointer"
              onClick={() => setViewingIndex(photos.indexOf(p))}
            />
            {p.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-xs text-white truncate">{p.caption}</p>
              </div>
            )}
            {!isLocked && (
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}

        {Array.from({ length: uploadingCount }).map((_, i) => (
          <div key={`skeleton-${i}`} className="rounded-lg overflow-hidden border border-border h-32 bg-muted/30 animate-pulse flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>

      {viewingIndex !== null && (
        <Lightbox
          images={photos.map((p) => ({ src: p.url, alt: p.caption || '' }))}
          currentIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
          onNavigate={setViewingIndex}
        />
      )}
    </div>
  );
}

// ============================================
// Main Export
// ============================================

export function HighlightsTab(props: HighlightsTabProps) {
  return (
    <div className="space-y-8">
      <TimelineSection {...props} />
      <PhotosSection {...props} />
      <ValuesSection {...props} />
    </div>
  );
}
