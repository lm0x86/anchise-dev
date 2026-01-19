'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users,
  MessageSquare,
  Eye,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface DashboardStats {
  totalProfiles: number;
  pendingTributes: number;
  approvedTributes: number;
  recentViews: number;
}

interface PartnerDashboard {
  partner: {
    id: string;
    name: string;
    verified: boolean;
  };
  stats: DashboardStats;
  recentProfiles?: Array<{
    id: string;
    slug: string;
    firstName: string;
    lastName: string;
    deathDate: string;
    createdAt: string;
  }>;
}

async function fetchDashboard(token: string): Promise<PartnerDashboard> {
  const response = await fetch(`${API_URL}/partners/my/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard');
  }

  return response.json();
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  trend?: string;
  href?: string;
}) {
  const content = (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold mt-1 font-mono">{value}</p>
          {trend && (
            <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {trend}
            </p>
          )}
        </div>
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export default function PartnerDashboardPage() {
  const token = useAccessToken();

  const { data: dashboard, isLoading, isError } = useQuery({
    queryKey: ['partner', 'dashboard', token],
    queryFn: () => fetchDashboard(token!),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Unable to load dashboard</h2>
        <p className="text-muted-foreground mb-4">
          There was an error loading your partner dashboard.
        </p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold">
          Welcome back, {dashboard.partner.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your memorial activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Memorials"
          value={dashboard.stats.totalProfiles}
          href="/partner/memorials"
        />
        <StatCard
          icon={MessageSquare}
          label="Pending Tributes"
          value={dashboard.stats.pendingTributes}
          href="/partner/moderation"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved Tributes"
          value={dashboard.stats.approvedTributes}
        />
        <StatCard
          icon={Eye}
          label="Views (30 days)"
          value={dashboard.stats.recentViews.toLocaleString()}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Memorials */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Recent Memorials</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/partner/memorials">View all</Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {dashboard.recentProfiles && dashboard.recentProfiles.length > 0 ? (
              dashboard.recentProfiles.slice(0, 5).map((profile) => (
                <Link
                  key={profile.id}
                  href={`/partner/memorials/${profile.id}`}
                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {profile.firstName} {profile.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(profile.deathDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No memorials yet</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/partner/memorials/new">Create your first memorial</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Pending Moderation */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Pending Moderation</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/partner/moderation">View all</Link>
            </Button>
          </div>
          <div className="p-8 text-center">
            {dashboard.stats.pendingTributes > 0 ? (
              <>
                <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-yellow-500" />
                </div>
                <p className="text-2xl font-semibold">
                  {dashboard.stats.pendingTributes}
                </p>
                <p className="text-muted-foreground mt-1">
                  tributes awaiting review
                </p>
                <Button asChild className="mt-4">
                  <Link href="/partner/moderation">Review Now</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <p className="font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No tributes pending moderation
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

