'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Trophy,
  Quote,
  MessageSquare,
  BarChart3,
  Loader2,
} from 'lucide-react';
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
import {
  quotesApi,
  achievementsApi,
  futureMessagesApi,
  statsApi,
  type ProfileQuote,
  type QuoteCategory,
  type Achievement,
  type AchievementCategory,
  type FutureMessage,
  type ProfileStat,
} from '@/lib/memorial-content-api';

interface LegacyTabProps {
  profileId: string;
  token: string;
  isLocked: boolean;
}

const QUOTE_CATEGORIES: { value: QuoteCategory; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'ON_WORK', label: 'On Work' },
  { value: 'ON_LOVE', label: 'On Love' },
  { value: 'ON_FAMILY', label: 'On Family' },
  { value: 'ON_ADVERSITY', label: 'On Adversity' },
  { value: 'ON_FRIENDSHIP', label: 'On Friendship' },
  { value: 'ON_LIFE', label: 'On Life' },
  { value: 'ON_FAITH', label: 'On Faith' },
];

const ACHIEVEMENT_CATEGORIES: { value: AchievementCategory; label: string }[] = [
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'PERSONAL', label: 'Personal' },
];

// ============================================
// Quotes / Life Lessons Section
// ============================================

function QuotesSection({ profileId, token, isLocked }: LegacyTabProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ text: '', attribution: '', category: 'GENERAL' as QuoteCategory });

  const { data: quotes = [] } = useQuery({
    queryKey: ['memorial-content', profileId, 'quotes'],
    queryFn: () => quotesApi.list(token, profileId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['memorial-content', profileId, 'quotes'] });
  const resetForm = () => setForm({ text: '', attribution: '', category: 'GENERAL' });

  function cleanForm(data: typeof form) {
    return { ...data, attribution: data.attribution || undefined };
  }

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => quotesApi.create(token, profileId, cleanForm(data)),
    onSuccess: () => { invalidate(); setShowForm(false); resetForm(); toast.success('Quote added'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) => quotesApi.update(token, profileId, id, cleanForm(data)),
    onSuccess: () => { invalidate(); setEditingId(null); resetForm(); toast.success('Quote updated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotesApi.delete(token, profileId, id),
    onSuccess: () => { invalidate(); toast.success('Quote deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  function startEdit(q: ProfileQuote) {
    setEditingId(q.id);
    setForm({ text: q.text, attribution: q.attribution || '', category: q.category });
    setShowForm(false);
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Quote className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Life Lessons & Quotes</h2>
          <span className="text-xs text-muted-foreground">({quotes.length})</span>
        </div>
        {!isLocked && !showForm && (
          <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {(showForm || editingId) && (
        <div className="border border-border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as QuoteCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUOTE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Attribution</Label>
              <Input value={form.attribution} onChange={(e) => setForm({ ...form, attribution: e.target.value })} placeholder="Who said this?" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quote Text *</Label>
            <Textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={2} placeholder="The wisdom they shared..." />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.text || isSubmitting} onClick={() =>
              editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)
            }>
              {isSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <Check className="h-3 w-3 mr-1" /> {editingId ? 'Update' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {quotes.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">No quotes yet</p>
      )}

      <div className="space-y-2">
        {quotes.map((q) => (
          <div key={q.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {QUOTE_CATEGORIES.find((c) => c.value === q.category)?.label || q.category}
                </span>
              </div>
              <p className="text-sm italic">&ldquo;{q.text}&rdquo;</p>
              {q.attribution && <p className="text-xs text-muted-foreground mt-1">— {q.attribution}</p>}
            </div>
            {!isLocked && (
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(q)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(q.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Achievements Section
// ============================================

function AchievementsSection({ profileId, token, isLocked }: LegacyTabProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'PROFESSIONAL' as AchievementCategory, date: '', endDate: '' });

  const { data: achievements = [] } = useQuery({
    queryKey: ['memorial-content', profileId, 'achievements'],
    queryFn: () => achievementsApi.list(token, profileId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['memorial-content', profileId, 'achievements'] });
  const resetForm = () => setForm({ title: '', description: '', category: 'PROFESSIONAL', date: '', endDate: '' });

  function cleanForm(data: typeof form) {
    return {
      ...data,
      description: data.description || undefined,
      date: data.date || undefined,
      endDate: data.endDate || undefined,
    };
  }

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => achievementsApi.create(token, profileId, cleanForm(data)),
    onSuccess: () => { invalidate(); setShowForm(false); resetForm(); toast.success('Achievement added'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) => achievementsApi.update(token, profileId, id, cleanForm(data)),
    onSuccess: () => { invalidate(); setEditingId(null); resetForm(); toast.success('Achievement updated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => achievementsApi.delete(token, profileId, id),
    onSuccess: () => { invalidate(); toast.success('Achievement deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  function startEdit(a: Achievement) {
    setEditingId(a.id);
    setForm({
      title: a.title,
      description: a.description || '',
      category: a.category,
      date: a.date?.split('T')[0] || '',
      endDate: a.endDate?.split('T')[0] || '',
    });
    setShowForm(false);
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Achievements</h2>
          <span className="text-xs text-muted-foreground">({achievements.length})</span>
        </div>
        {!isLocked && !showForm && (
          <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {(showForm || editingId) && (
        <div className="border border-border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Employee of the Year" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as AchievementCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACHIEVEMENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.title || isSubmitting} onClick={() =>
              editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)
            }>
              {isSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <Check className="h-3 w-3 mr-1" /> {editingId ? 'Update' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {achievements.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">No achievements yet</p>
      )}

      <div className="space-y-2">
        {achievements.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3 min-w-0">
              <div className="min-w-0">
                <span className="font-medium text-sm">{a.title}</span>
                <p className="text-xs text-muted-foreground">
                  {ACHIEVEMENT_CATEGORIES.find((c) => c.value === a.category)?.label}
                  {a.date && ` · ${new Date(a.date).getFullYear()}`}
                  {a.endDate && `–${new Date(a.endDate).getFullYear()}`}
                </p>
                {a.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>}
              </div>
            </div>
            {!isLocked && (
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(a)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(a.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Future Messages Section
// ============================================

function FutureMessagesSection({ profileId, token, isLocked }: LegacyTabProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ recipientName: '', content: '', videoUrl: '' });

  const { data: messages = [] } = useQuery({
    queryKey: ['memorial-content', profileId, 'future-messages'],
    queryFn: () => futureMessagesApi.list(token, profileId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['memorial-content', profileId, 'future-messages'] });
  const resetForm = () => setForm({ recipientName: '', content: '', videoUrl: '' });

  function cleanForm(data: typeof form) {
    return {
      ...data,
      recipientName: data.recipientName || undefined,
      videoUrl: data.videoUrl || undefined,
    };
  }

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => futureMessagesApi.create(token, profileId, cleanForm(data)),
    onSuccess: () => { invalidate(); setShowForm(false); resetForm(); toast.success('Message added'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) => futureMessagesApi.update(token, profileId, id, cleanForm(data)),
    onSuccess: () => { invalidate(); setEditingId(null); resetForm(); toast.success('Message updated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => futureMessagesApi.delete(token, profileId, id),
    onSuccess: () => { invalidate(); toast.success('Message deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  function startEdit(m: FutureMessage) {
    setEditingId(m.id);
    setForm({ recipientName: m.recipientName || '', content: m.content || '', videoUrl: m.videoUrl || '' });
    setShowForm(false);
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Advice & Future Messages</h2>
          <span className="text-xs text-muted-foreground">({messages.length})</span>
        </div>
        {!isLocked && !showForm && (
          <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {(showForm || editingId) && (
        <div className="border border-border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">To (recipient)</Label>
              <Input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} placeholder="e.g. Sofia, Everyone..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Video URL</Label>
              <Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Message *</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} placeholder="The message they wanted to share..." />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.content || isSubmitting} onClick={() =>
              editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)
            }>
              {isSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <Check className="h-3 w-3 mr-1" /> {editingId ? 'Update' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {messages.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">No future messages yet</p>
      )}

      <div className="space-y-2">
        {messages.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <div className="min-w-0">
              {m.recipientName && (
                <span className="text-xs font-medium text-primary">To {m.recipientName}</span>
              )}
              <p className="text-sm mt-0.5 line-clamp-3">&ldquo;{m.content}&rdquo;</p>
              {m.videoUrl && <p className="text-xs text-muted-foreground mt-1">Has video</p>}
            </div>
            {!isLocked && (
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(m)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(m.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Stats Section
// ============================================

function StatsSection({ profileId, token, isLocked }: LegacyTabProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', value: '' });

  const { data: stats = [] } = useQuery({
    queryKey: ['memorial-content', profileId, 'stats'],
    queryFn: () => statsApi.list(token, profileId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['memorial-content', profileId, 'stats'] });
  const resetForm = () => setForm({ label: '', value: '' });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => statsApi.create(token, profileId, data),
    onSuccess: () => { invalidate(); setShowForm(false); resetForm(); toast.success('Stat added'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) => statsApi.update(token, profileId, id, data),
    onSuccess: () => { invalidate(); setEditingId(null); resetForm(); toast.success('Stat updated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => statsApi.delete(token, profileId, id),
    onSuccess: () => { invalidate(); toast.success('Stat deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  function startEdit(s: ProfileStat) {
    setEditingId(s.id);
    setForm({ label: s.label, value: s.value });
    setShowForm(false);
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Life Stats</h2>
          <span className="text-xs text-muted-foreground">({stats.length})</span>
        </div>
        {!isLocked && !showForm && (
          <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {(showForm || editingId) && (
        <div className="border border-border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Label *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Patents" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Value *</Label>
              <Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="e.g. 12" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.label || !form.value || isSubmitting} onClick={() =>
              editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)
            }>
              {isSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <Check className="h-3 w-3 mr-1" /> {editingId ? 'Update' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {stats.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">No stats yet</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.id} className="relative group p-4 rounded-lg border border-border text-center hover:bg-muted/30 transition-colors">
            <div className="text-2xl font-bold text-primary">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            {!isLocked && (
              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(s)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Export
// ============================================

export function LegacyTab(props: LegacyTabProps) {
  return (
    <div className="space-y-8">
      <QuotesSection {...props} />
      <AchievementsSection {...props} />
      <FutureMessagesSection {...props} />
      <StatsSection {...props} />
    </div>
  );
}
