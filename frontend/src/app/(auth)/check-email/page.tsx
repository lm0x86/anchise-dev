'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/components/auth/auth-layout';
import { useResendVerification } from '@/hooks/use-auth';

export default function CheckEmailPage() {
  const t = useTranslations('auth.checkEmail');
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const resendMutation = useResendVerification();

  const handleResend = () => {
    if (email) {
      resendMutation.mutate(email);
    }
  };

  return (
    <AuthLayout title={t('title')}>
      <div className="text-center space-y-6">
        {/* Email icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Email display */}
        <div>
          <p className="text-muted-foreground mb-2">{t('subtitle')}</p>
          <p className="font-medium text-lg">{email}</p>
        </div>

        {/* Instructions */}
        <p className="text-sm text-muted-foreground">
          {t('instructions')}
        </p>

        {/* Resend button */}
        <Button
          variant="outline"
          onClick={handleResend}
          disabled={resendMutation.isPending}
          className="w-full"
        >
          {resendMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('resend')}
        </Button>

        {/* Back to login */}
        <div className="pt-4 border-t border-border">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

