'use client';

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode, useEffect, useRef } from 'react';
import { useAuthStore, getValidAccessToken } from '@/store/auth';
import { toast } from 'sonner';

// Custom error class to identify auth errors
class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Proactive token refresh component
 * Checks token expiry every minute and refreshes if needed
 */
function TokenRefreshManager() {
  const { tokens, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !tokens?.accessToken) return;

    // Check token every minute
    const interval = setInterval(async () => {
      // getValidAccessToken will refresh if needed
      await getValidAccessToken();
    }, 60 * 1000); // Every minute

    return () => clearInterval(interval);
  }, [isAuthenticated, tokens?.accessToken]);

  return null;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const logout = useAuthStore((state) => state.logout);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry auth errors
              if (error instanceof AuthError) {
                return false;
              }
              // Don't retry 401s
              if (error instanceof Error && error.message.includes('401')) {
                return false;
              }
              // Standard retry logic
              return failureCount < 3;
            },
          },
          mutations: {
            retry: false,
          },
        },
        queryCache: new QueryCache({
          onError: async (error, query) => {
            // Handle 401 errors by attempting token refresh
            if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
              const queryKey = JSON.stringify(query.queryKey);
              const retryCount = retryCountRef.current.get(queryKey) || 0;
              
              // Only try to refresh once per query
              if (retryCount < 1) {
                retryCountRef.current.set(queryKey, retryCount + 1);
                const newToken = await getValidAccessToken();
                if (newToken) {
                  // Token refreshed, invalidate to trigger refetch
                  queryClient.invalidateQueries({ queryKey: query.queryKey });
                } else {
                  // Refresh failed
                  toast.error('Session expired. Please log in again.');
                }
              } else {
                // Already tried refresh, clear retry count
                retryCountRef.current.delete(queryKey);
              }
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: async (error) => {
            // Handle 401 errors in mutations
            if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
              const newToken = await getValidAccessToken();
              if (!newToken) {
                toast.error('Session expired. Please log in again.');
              }
            }
          },
        }),
      }),
  );

  // Clear retry counts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      retryCountRef.current.clear();
    }, 60000); // Clear every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TokenRefreshManager />
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

