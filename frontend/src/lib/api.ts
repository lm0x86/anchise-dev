const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
};

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: unknown,
  ) {
    super(`${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, token } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, data);
  }

  return data as T;
}

// ============================================
// AUTH API
// ============================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  role: 'USER' | 'PARTNER' | 'ADMIN';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string | number;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface RegisterResponse {
  user: User;
  message: string;
}

export const authApi = {
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    request<RegisterResponse>('/auth/register', { method: 'POST', body: data }),

  verifyEmail: (token: string) =>
    request<{ message: string; user: User }>('/auth/verify-email', { method: 'POST', body: { token } }),

  resendVerification: (email: string) =>
    request<{ message: string }>('/auth/resend-verification', { method: 'POST', body: { email } }),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: data }),

  refresh: (refreshToken: string) =>
    request<{ tokens: Tokens }>('/auth/refresh', { method: 'POST', body: { refreshToken } }),

  me: (token: string) =>
    request<{ user: User }>('/auth/me', { token }),

  changePassword: (data: { currentPassword: string; newPassword: string }, token: string) =>
    request<{ message: string }>('/auth/change-password', { method: 'POST', body: data, token }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (data: { token: string; newPassword: string }) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: data }),
};

// ============================================
// PROFILES API
// ============================================

export interface Profile {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  deathDate: string;
  sex: 'MALE' | 'FEMALE' | null;
  birthPlaceCog: string | null;
  birthPlaceLabel: string | null;
  deathPlaceCog: string;
  deathPlaceLabel: string | null;
  pinLat: number;
  pinLng: number;
  source: 'PARTNER' | 'INSEE' | 'MERGED';
  photoUrl: string | null;
  obituary: string | null;
  serviceDetails: Record<string, unknown> | null;
  isLocked: boolean;
  partnerId: string | null;
  partnerName: string | null;
  createdAt: string;
  updatedAt: string;
  tributeCount?: number;
}

export interface BoardProfile {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  deathDate: string;
  deathPlaceLabel: string | null;
  pinLat: number;
  pinLng: number;
  isVerified: boolean;
  photoUrl: string | null;
}

export interface ProfileListResponse {
  profiles: Profile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProfileQueryParams {
  from?: string;
  to?: string;
  cog?: string;
  verifiedOnly?: boolean;
  hasTributes?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  // Viewport bounding box
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
}

export const profilesApi = {
  list: (params?: ProfileQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const query = searchParams.toString();
    return request<ProfileListResponse>(`/profiles${query ? `?${query}` : ''}`);
  },

  getBoard: (params?: ProfileQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const query = searchParams.toString();
    return request<BoardProfile[]>(`/profiles/board${query ? `?${query}` : ''}`);
  },

  get: (idOrSlug: string) =>
    request<Profile>(`/profiles/${idOrSlug}`),

  create: (data: Partial<Profile>, token: string) =>
    request<Profile>('/profiles', { method: 'POST', body: data, token }),

  update: (id: string, data: Partial<Profile>, token: string) =>
    request<Profile>(`/profiles/${id}`, { method: 'PATCH', body: data, token }),
};

// ============================================
// TRIBUTES API
// ============================================

export interface Tribute {
  id: string;
  profileId: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'HIDDEN' | 'REMOVED';
  author: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TributeListResponse {
  tributes: Tribute[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const tributesApi = {
  list: (params?: { profileId?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const query = searchParams.toString();
    return request<TributeListResponse>(`/tributes${query ? `?${query}` : ''}`);
  },

  getByProfile: (profileId: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const query = searchParams.toString();
    return request<TributeListResponse>(`/tributes/profile/${profileId}${query ? `?${query}` : ''}`);
  },

  create: (data: { profileId: string; content: string }, token: string) =>
    request<Tribute>('/tributes', { method: 'POST', body: data, token }),

  update: (id: string, content: string, token: string) =>
    request<Tribute>(`/tributes/${id}`, { method: 'PATCH', body: { content }, token }),

  delete: (id: string, token: string) =>
    request<void>(`/tributes/${id}`, { method: 'DELETE', token }),

  getModerationQueue: (params?: { page?: number; limit?: number }, token?: string) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const query = searchParams.toString();
    return request<TributeListResponse>(`/tributes/moderation/queue${query ? `?${query}` : ''}`, { token: token || undefined });
  },

  moderate: (id: string, status: 'APPROVED' | 'HIDDEN' | 'REMOVED', token: string) =>
    request<Tribute>(`/tributes/${id}/moderate`, { method: 'PATCH', body: { status }, token }),
};

// ============================================
// PARTNERS API
// ============================================

export interface Partner {
  id: string;
  name: string;
  slug: string;
  type: 'FUNERAL_HOME' | 'CHURCH' | 'HOSPITAL' | 'OTHER';
  contactEmail: string;
  logoUrl: string | null;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  profileCount?: number;
}

export interface PartnerListResponse {
  partners: Partner[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const partnersApi = {
  list: (params?: { type?: string; search?: string; verifiedOnly?: boolean; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const query = searchParams.toString();
    return request<PartnerListResponse>(`/partners${query ? `?${query}` : ''}`);
  },

  get: (id: string) =>
    request<Partner>(`/partners/${id}`),

  getDashboard: (id: string, token: string) =>
    request<{ partner: Partner; stats: { totalProfiles: number; pendingTributes: number; approvedTributes: number; recentViews: number }; users: unknown[] }>(`/partners/${id}/dashboard`, { token }),
};

// ============================================
// UPLOADS API
// ============================================

export const uploadsApi = {
  getPresignedUrl: (filename: string, contentType: string, folder?: string, token?: string) =>
    request<{ uploadUrl: string; key: string; publicUrl: string; expiresIn: number }>(
      '/uploads/presigned-url',
      { method: 'POST', body: { filename, contentType, folder }, token: token || undefined },
    ),
};

export { ApiError };

