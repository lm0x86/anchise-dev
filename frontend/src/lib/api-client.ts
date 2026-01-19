/**
 * API Client with automatic token refresh
 * 
 * This module provides a fetch wrapper that:
 * 1. Automatically adds the Authorization header
 * 2. Intercepts 401 responses
 * 3. Attempts to refresh the token
 * 4. Retries the original request
 * 5. Logs out if refresh fails
 */

import { useAuthStore } from '@/store/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

interface RefreshResponse {
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string | number;
  };
}

/**
 * Attempt to refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<boolean> {
  const { tokens, setTokens, logout } = useAuthStore.getState();
  
  if (!tokens?.refreshToken) {
    logout();
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed - log out
      logout();
      return false;
    }

    const data: RefreshResponse = await response.json();
    setTokens(data.tokens);
    return true;
  } catch (error) {
    console.error('Token refresh failed:', error);
    logout();
    return false;
  }
}

/**
 * Get a refreshed token, ensuring only one refresh happens at a time
 */
async function ensureValidToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = refreshAccessToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

export interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Authenticated fetch wrapper with automatic token refresh
 */
export async function authFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipAuth, ...fetchOptions } = options;
  const { tokens } = useAuthStore.getState();
  
  // Build full URL if relative
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  
  // Add auth header if we have a token and not skipping auth
  const headers = new Headers(fetchOptions.headers);
  if (!skipAuth && tokens?.accessToken) {
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }

  // Make the request
  let response = await fetch(fullUrl, {
    ...fetchOptions,
    headers,
  });

  // If 401 and we have a refresh token, try to refresh
  if (response.status === 401 && !skipAuth && tokens?.refreshToken) {
    const refreshed = await ensureValidToken();
    
    if (refreshed) {
      // Get the new token and retry
      const { tokens: newTokens } = useAuthStore.getState();
      if (newTokens?.accessToken) {
        headers.set('Authorization', `Bearer ${newTokens.accessToken}`);
        response = await fetch(fullUrl, {
          ...fetchOptions,
          headers,
        });
      }
    }
  }

  return response;
}

/**
 * JSON fetch helper with automatic token refresh
 */
export async function apiFetch<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await authFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Upload file with automatic token refresh
 */
export async function apiUpload(
  url: string,
  file: File,
  fieldName: string = 'file'
): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append(fieldName, file);

  const response = await authFetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

