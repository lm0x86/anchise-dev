'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  RefreshCw,
  Users,
  Building2,
  Settings,
  ChevronLeft,
  ClipboardCheck,
} from 'lucide-react';
import { useAuthStore, useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const adminNavItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/integrations', icon: RefreshCw, label: 'Integrations' },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/partners', icon: Building2, label: 'Partners' },
  { href: '/admin/partner-requests', icon: ClipboardCheck, label: 'Partner Requests', badge: true },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];

async function fetchPendingCount(token: string): Promise<number> {
  try {
    const response = await fetch(`${API_URL}/partners/admin/pending?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.total ?? 0;
  } catch {
    return 0;
  }
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const token = useAccessToken();

  // Fetch pending partner requests count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['admin', 'partner-requests', 'count', token],
    queryFn: () => fetchPendingCount(token!),
    enabled: !!token && user?.role === 'ADMIN',
    refetchInterval: 60000, // Refresh every minute
  });

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      if (user?.role !== 'ADMIN') {
        router.push('/');
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Show loading while checking auth
  if (isLoading || !isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-2xl">🏺</span>
            <span className="text-lg font-serif font-semibold text-primary">
              Admin
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3">
          <ul className="space-y-1">
            {adminNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && pendingCount > 0 && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Back to site */}
        <div className="p-4 border-t border-border">
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to site
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary text-sm font-medium">
              {user.firstName[0]}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

