'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Settings,
  ChevronLeft,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import { useAuthStore, useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface PartnerInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
}

const partnerNavItems = [
  { href: '/partner', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/partner/memorials', icon: Users, label: 'Memorials' },
  { href: '/partner/moderation', icon: MessageSquare, label: 'Moderation' },
  { href: '/partner/settings', icon: Settings, label: 'Settings' },
];

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const token = useAccessToken();
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      if (user?.role !== 'PARTNER' && user?.role !== 'ADMIN') {
        router.push('/');
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Fetch partner info
  useEffect(() => {
    async function fetchPartnerInfo() {
      if (!token || !user) return;
      
      try {
        // Get the user's partner ID from their profile
        const response = await fetch(`${API_URL}/partners/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setPartnerInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch partner info:', error);
      }
    }

    if (token && user?.role === 'PARTNER') {
      fetchPartnerInfo();
    }
  }, [token, user]);

  // Show loading while checking auth
  if (isLoading || !isAuthenticated || (user?.role !== 'PARTNER' && user?.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transform transition-transform duration-200 lg:transform-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <Link href="/partner" className="flex items-center gap-2">
            <span className="text-2xl">⚱</span>
            <span className="text-lg font-serif font-semibold text-primary">
              Partner Portal
            </span>
          </Link>
          <button
            className="lg:hidden text-muted-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Partner info */}
        {partnerInfo && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              {partnerInfo.logoUrl ? (
                <img
                  src={partnerInfo.logoUrl}
                  alt={partnerInfo.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-semibold">
                  {partnerInfo.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{partnerInfo.name}</p>
                {partnerInfo.verified && (
                  <span className="text-xs text-green-500">✓ Verified</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3">
          <ul className="space-y-1">
            {partnerNavItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/partner' && pathname.startsWith(item.href));
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Quick action */}
          <div className="mt-6 px-3">
            <Button asChild className="w-full">
              <Link href="/partner/memorials/new">
                <Plus className="w-4 h-4 mr-2" />
                New Memorial
              </Link>
            </Button>
          </div>
        </nav>

        {/* Back to site */}
        <div className="p-4 border-t border-border">
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/board">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to site
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6">
          <button
            className="lg:hidden text-muted-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary text-sm font-medium">
              {user?.firstName?.[0] || 'P'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

