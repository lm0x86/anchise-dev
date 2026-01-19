'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, FileText, MessageSquare, Building2 } from 'lucide-react';
import { useAccessToken } from '@/store/auth';

interface DashboardStats {
  totalUsers: number;
  totalProfiles: number;
  totalTributes: number;
  totalPartners: number;
  inseeProfiles: number;
  pendingTributes: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

async function fetchDashboardStats(token: string): Promise<DashboardStats> {
  // For now, return mock data - we'll add the real endpoint later
  // In a real implementation, this would call /api/admin/dashboard/stats
  return {
    totalUsers: 0,
    totalProfiles: 0,
    totalTributes: 0,
    totalPartners: 0,
    inseeProfiles: 0,
    pendingTributes: 0,
  };
}

const statCards = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, color: 'text-blue-500' },
  { key: 'totalProfiles', label: 'Total Profiles', icon: FileText, color: 'text-green-500' },
  { key: 'totalTributes', label: 'Total Tributes', icon: MessageSquare, color: 'text-purple-500' },
  { key: 'totalPartners', label: 'Partners', icon: Building2, color: 'text-orange-500' },
];

export default function AdminDashboardPage() {
  const token = useAccessToken();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => fetchDashboardStats(token!),
    enabled: !!token,
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your Anchise platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.key}
            className="bg-card border border-border rounded-xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-semibold mt-1">
                  {isLoading ? (
                    <span className="animate-pulse">--</span>
                  ) : (
                    stats?.[stat.key as keyof DashboardStats] ?? 0
                  )}
                </p>
              </div>
              <div className={`p-3 rounded-lg bg-accent ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/admin/integrations"
            className="p-4 border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <h3 className="font-medium">Sync INSEE Data</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Import death records from matchID
            </p>
          </a>
          <a
            href="/admin/users"
            className="p-4 border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <h3 className="font-medium">Manage Users</h3>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage user accounts
            </p>
          </a>
          <a
            href="/admin/partners"
            className="p-4 border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <h3 className="font-medium">Manage Partners</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manage funeral homes and churches
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}

