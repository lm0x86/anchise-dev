const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

async function req<T>(
  endpoint: string,
  token: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { method = 'GET', body } = options;
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  if (method === 'DELETE') return undefined as T;
  return res.json();
}

const base = (id: string) => `/partners/my/memorials/${id}`;

// ============================================
// Types
// ============================================

export interface TimelineEvent {
  id: string;
  profileId: string;
  title: string;
  description: string | null;
  date: string;
  endDate: string | null;
  mediaUrl: string | null;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaItem {
  id: string;
  profileId: string | null;
  albumId: string | null;
  memoryId: string | null;
  url: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO';
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ProfileValue {
  id: string;
  profileId: string;
  value: string;
  meaning: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type QuoteCategory =
  | 'GENERAL'
  | 'ON_WORK'
  | 'ON_LOVE'
  | 'ON_FAMILY'
  | 'ON_ADVERSITY'
  | 'ON_FRIENDSHIP'
  | 'ON_LIFE'
  | 'ON_FAITH';

export interface ProfileQuote {
  id: string;
  profileId: string;
  text: string;
  attribution: string | null;
  category: QuoteCategory;
  audioUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type AchievementCategory = 'PROFESSIONAL' | 'PERSONAL';

export interface Achievement {
  id: string;
  profileId: string;
  title: string;
  description: string | null;
  category: AchievementCategory;
  date: string | null;
  endDate: string | null;
  mediaUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FutureMessage {
  id: string;
  profileId: string;
  recipientName: string | null;
  content: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  isPinned: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStat {
  id: string;
  profileId: string;
  label: string;
  value: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API functions
// ============================================

export const timelineApi = {
  list: (token: string, profileId: string) =>
    req<TimelineEvent[]>(`${base(profileId)}/timeline-events`, token),
  create: (token: string, profileId: string, data: Partial<TimelineEvent>) =>
    req<TimelineEvent>(`${base(profileId)}/timeline-events`, token, { method: 'POST', body: data }),
  update: (token: string, profileId: string, itemId: string, data: Partial<TimelineEvent>) =>
    req<TimelineEvent>(`${base(profileId)}/timeline-events/${itemId}`, token, { method: 'PATCH', body: data }),
  delete: (token: string, profileId: string, itemId: string) =>
    req<void>(`${base(profileId)}/timeline-events/${itemId}`, token, { method: 'DELETE' }),
};

export const mediaApi = {
  list: (token: string, profileId: string) =>
    req<MediaItem[]>(`${base(profileId)}/media`, token),
  create: (token: string, profileId: string, data: { url: string; type?: string; caption?: string }) =>
    req<MediaItem>(`${base(profileId)}/media`, token, { method: 'POST', body: data }),
  delete: (token: string, profileId: string, itemId: string) =>
    req<void>(`${base(profileId)}/media/${itemId}`, token, { method: 'DELETE' }),
};

export const valuesApi = {
  list: (token: string, profileId: string) =>
    req<ProfileValue[]>(`${base(profileId)}/values`, token),
  create: (token: string, profileId: string, data: { value: string; meaning?: string }) =>
    req<ProfileValue>(`${base(profileId)}/values`, token, { method: 'POST', body: data }),
  update: (token: string, profileId: string, itemId: string, data: Partial<ProfileValue>) =>
    req<ProfileValue>(`${base(profileId)}/values/${itemId}`, token, { method: 'PATCH', body: data }),
  delete: (token: string, profileId: string, itemId: string) =>
    req<void>(`${base(profileId)}/values/${itemId}`, token, { method: 'DELETE' }),
};

export const quotesApi = {
  list: (token: string, profileId: string) =>
    req<ProfileQuote[]>(`${base(profileId)}/quotes`, token),
  create: (token: string, profileId: string, data: Partial<ProfileQuote>) =>
    req<ProfileQuote>(`${base(profileId)}/quotes`, token, { method: 'POST', body: data }),
  update: (token: string, profileId: string, itemId: string, data: Partial<ProfileQuote>) =>
    req<ProfileQuote>(`${base(profileId)}/quotes/${itemId}`, token, { method: 'PATCH', body: data }),
  delete: (token: string, profileId: string, itemId: string) =>
    req<void>(`${base(profileId)}/quotes/${itemId}`, token, { method: 'DELETE' }),
};

export const achievementsApi = {
  list: (token: string, profileId: string) =>
    req<Achievement[]>(`${base(profileId)}/achievements`, token),
  create: (token: string, profileId: string, data: Partial<Achievement>) =>
    req<Achievement>(`${base(profileId)}/achievements`, token, { method: 'POST', body: data }),
  update: (token: string, profileId: string, itemId: string, data: Partial<Achievement>) =>
    req<Achievement>(`${base(profileId)}/achievements/${itemId}`, token, { method: 'PATCH', body: data }),
  delete: (token: string, profileId: string, itemId: string) =>
    req<void>(`${base(profileId)}/achievements/${itemId}`, token, { method: 'DELETE' }),
};

export const futureMessagesApi = {
  list: (token: string, profileId: string) =>
    req<FutureMessage[]>(`${base(profileId)}/future-messages`, token),
  create: (token: string, profileId: string, data: Partial<FutureMessage>) =>
    req<FutureMessage>(`${base(profileId)}/future-messages`, token, { method: 'POST', body: data }),
  update: (token: string, profileId: string, itemId: string, data: Partial<FutureMessage>) =>
    req<FutureMessage>(`${base(profileId)}/future-messages/${itemId}`, token, { method: 'PATCH', body: data }),
  delete: (token: string, profileId: string, itemId: string) =>
    req<void>(`${base(profileId)}/future-messages/${itemId}`, token, { method: 'DELETE' }),
};

export const statsApi = {
  list: (token: string, profileId: string) =>
    req<ProfileStat[]>(`${base(profileId)}/stats`, token),
  create: (token: string, profileId: string, data: { label: string; value: string }) =>
    req<ProfileStat>(`${base(profileId)}/stats`, token, { method: 'POST', body: data }),
  update: (token: string, profileId: string, itemId: string, data: Partial<ProfileStat>) =>
    req<ProfileStat>(`${base(profileId)}/stats/${itemId}`, token, { method: 'PATCH', body: data }),
  delete: (token: string, profileId: string, itemId: string) =>
    req<void>(`${base(profileId)}/stats/${itemId}`, token, { method: 'DELETE' }),
};
