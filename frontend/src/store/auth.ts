import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Tokens } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (user: User, tokens: Tokens) => void;
  setUser: (user: User) => void;
  setTokens: (tokens: Tokens) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, tokens) =>
        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
        }),

      setUser: (user) =>
        set({ user }),

      setTokens: (tokens) =>
        set({ tokens }),

      logout: () =>
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (isLoading) =>
        set({ isLoading }),
    }),
    {
      name: 'anchise-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Set loading to false after hydration completes
        if (state) {
          state.setLoading(false);
        }
      },
    },
  ),
);

// Selector hooks for convenience
export const useUser = () => useAuthStore((state) => state.user);
export const useTokens = () => useAuthStore((state) => state.tokens);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);

// Token refresh state
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Decode JWT to get expiration time
 */
function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.exp ? decoded.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
}

/**
 * Check if token is expired or about to expire (within 60 seconds)
 */
function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  return Date.now() >= exp - bufferSeconds * 1000;
}

/**
 * Refresh the access token
 */
async function refreshAccessToken(): Promise<string | null> {
  const { tokens, setTokens, logout } = useAuthStore.getState();
  
  if (!tokens?.refreshToken) {
    logout();
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      console.warn('Token refresh failed with status:', response.status);
      logout();
      return null;
    }

    const data = await response.json();
    setTokens(data.tokens);
    console.log('Access token refreshed successfully');
    return data.tokens.accessToken;
  } catch (error) {
    console.error('Token refresh error:', error);
    logout();
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 * This is the main function components should use
 */
export async function getValidAccessToken(): Promise<string | null> {
  const { tokens } = useAuthStore.getState();
  
  if (!tokens?.accessToken) {
    return null;
  }

  // If token is not expired, return it
  if (!isTokenExpired(tokens.accessToken)) {
    return tokens.accessToken;
  }

  // Token is expired or about to expire, refresh it
  // Ensure only one refresh happens at a time
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

/**
 * Hook to get a valid access token with automatic refresh
 * Returns the current token and a function to get a fresh one if needed
 */
export function useAccessToken(): string | null {
  const tokens = useAuthStore((state) => state.tokens);
  return tokens?.accessToken ?? null;
}

/**
 * Hook that provides a function to get a valid token (with auto-refresh)
 */
export function useGetValidToken() {
  return getValidAccessToken;
}

