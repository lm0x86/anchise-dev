'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { authApi, ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

/**
 * Extract error message from API error response
 * Prioritizes server message, falls back to provided default
 */
function getErrorMessage(error: ApiError, fallback: string): string {
  // Try to get message from server response
  const data = error.data as { message?: string } | null;
  if (data?.message) {
    return data.message;
  }
  return fallback;
}

export function useLogin() {
  const router = useRouter();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.tokens);
      toast.success(t('success.login'));
      router.push('/board');
    },
    onError: (error: ApiError) => {
      if (error.status === 401) {
        toast.error(t('login.invalidCredentials'));
      } else {
        toast.error(getErrorMessage(error, tCommon('error')));
      }
    },
  });
}

export function useRegister() {
  const router = useRouter();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      // Don't set auth - user needs to verify email first
      toast.success(t('success.register'));
      // Redirect to check-email page with email in query
      router.push(`/check-email?email=${encodeURIComponent(data.user.email)}`);
    },
    onError: (error: ApiError) => {
      if (error.status === 409) {
        toast.error(t('register.emailExists'));
      } else {
        toast.error(getErrorMessage(error, tCommon('error')));
      }
    },
  });
}

export function useVerifyEmail() {
  const router = useRouter();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');

  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
    onSuccess: () => {
      toast.success(t('verifyEmail.success'));
      router.push('/login');
    },
    onError: (error: ApiError) => {
      if (error.status === 400) {
        toast.error(t('verifyEmail.invalidLink'));
      } else {
        toast.error(getErrorMessage(error, tCommon('error')));
      }
    },
  });
}

export function useResendVerification() {
  const t = useTranslations('auth');

  return useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => {
      toast.success(t('checkEmail.resent'));
    },
    onError: () => {
      // Always show success to prevent email enumeration
      toast.success(t('checkEmail.resent'));
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('auth');
  const logout = useAuthStore((state) => state.logout);

  return () => {
    logout();
    queryClient.clear();
    toast.success(t('success.logout'));
    router.push('/');
  };
}

export function useForgotPassword() {
  const t = useTranslations('auth');

  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () => {
      toast.success(t('forgotPassword.emailSentMessage'));
    },
    onError: () => {
      // Always show success to prevent email enumeration
      toast.success(t('forgotPassword.emailSentMessage'));
    },
  });
}

export function useResetPassword() {
  const router = useRouter();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');

  return useMutation({
    mutationFn: (data: { token: string; newPassword: string }) => authApi.resetPassword(data),
    onSuccess: () => {
      toast.success(t('resetPassword.success'));
      router.push('/login');
    },
    onError: (error: ApiError) => {
      if (error.status === 400) {
        toast.error(t('resetPassword.invalidLinkMessage'));
      } else {
        toast.error(getErrorMessage(error, tCommon('error')));
      }
    },
  });
}

export function useChangePassword() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const token = useAuthStore((state) => state.tokens?.accessToken);

  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data, token!),
    onSuccess: () => {
      toast.success(t('success.passwordChanged'));
    },
    onError: (error: ApiError) => {
      if (error.status === 401) {
        toast.error(t('changePassword.incorrectCurrent'));
      } else {
        toast.error(getErrorMessage(error, tCommon('error')));
      }
    },
  });
}
