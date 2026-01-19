'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations('home');
  const tNav = useTranslations('nav');
  const tFooter = useTranslations('footer');
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/board');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect if authenticated
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">⚱</span>
            <span className="text-xl font-serif font-semibold text-primary">Anchise</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/board">
              <Button variant="ghost">{tNav('board')}</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">{tNav('login')}</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-5 py-20">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold mb-6">
            {t('title')}
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            {t('subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/board">
              <Button size="lg" className="w-full sm:w-auto">
                {t('exploreBoard')}
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {t('createAccount')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-5 text-center text-muted-foreground text-sm">
          <p>{tFooter('copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </main>
  );
}
