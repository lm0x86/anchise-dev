'use client';

import { useCallback } from 'react';
import { getValidAccessToken, useAuthStore } from '@/store/auth';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Hook that provides an authenticated fetch function with automatic token refresh
 */
export function useAuthFetch() {
  const logout = useAuthStore((state) => state.logout);

  const authFetch = useCallback(
    async <T = unknown>(
      endpoint: string,
      options: FetchOptions = {}
    ): Promise<T> => {
      // Get a valid token (refreshes if needed)
      const token = await getValidAccessToken();

      if (!token) {
        toast.error('Session expired. Please log in again.');
        throw new Error('No valid token');
      }

      const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
      const { body, ...restOptions } = options;

      const response = await fetch(url, {
        ...restOptions,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...restOptions.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle 401 - token might have been invalidated server-side
      if (response.status === 401) {
        // Try to refresh one more time
        const newToken = await getValidAccessToken();
        if (newToken && newToken !== token) {
          // Retry with new token
          const retryResponse = await fetch(url, {
            ...restOptions,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${newToken}`,
              ...restOptions.headers,
            },
            body: body ? JSON.stringify(body) : undefined,
          });

          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }

        // Refresh failed or retry failed
        toast.error('Session expired. Please log in again.');
        logout();
        throw new Error('Session expired');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text);
    },
    [logout]
  );

  return authFetch;
}

/**
 * Hook for file uploads with authentication
 */
export function useAuthUpload() {
  const logout = useAuthStore((state) => state.logout);

  const authUpload = useCallback(
    async (
      endpoint: string,
      file: File,
      fieldName: string = 'file'
    ): Promise<{ url: string; key: string }> => {
      const token = await getValidAccessToken();

      if (!token) {
        toast.error('Session expired. Please log in again.');
        throw new Error('No valid token');
      }

      const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
      const formData = new FormData();
      formData.append(fieldName, file);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        throw new Error('Session expired');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [logout]
  );

  return authUpload;
}

