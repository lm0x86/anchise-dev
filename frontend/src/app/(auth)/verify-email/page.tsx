'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/components/auth/auth-layout';
import { useVerifyEmail } from '@/hooks/use-auth';

export default function VerifyEmailPage() {
  const t = useTranslations('auth.verifyEmail');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const verifyMutation = useVerifyEmail();
  const [hasTriedVerify, setHasTriedVerify] = useState(false);

  useEffect(() => {
    if (token && !hasTriedVerify) {
      setHasTriedVerify(true);
      verifyMutation.mutate(token);
    }
  }, [token, hasTriedVerify, verifyMutation]);

  // Loading state
  if (verifyMutation.isPending || (!hasTriedVerify && token)) {
    return (
      <AuthLayout title={t('title')}>
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
          <p className="text-muted-foreground">{t('verifying')}</p>
        </div>
      </AuthLayout>
    );
  }

  // Success state
  if (verifyMutation.isSuccess) {
    return (
      <AuthLayout title={t('title')}>
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <p className="text-muted-foreground">{t('success')}</p>
          <Button asChild className="w-full">
            <Link href="/login">
              {t('title')}
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Error state (no token or verification failed)
  return (
    <AuthLayout title={t('title')}>
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>
        <p className="text-muted-foreground">{t('invalidLink')}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">
            {t('requestNewLink')}
          </Link>
        </Button>
        <div className="pt-4 border-t border-border">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

