'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle2, XCircle, Loader2, Calendar, StopCircle, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useAccessToken } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface InseeJob {
  id: string;
  fileName: string;
  fileMonth: string;
  recordCount: number;
  processedCount: number;
  newProfiles: number;
  mergedProfiles: number;
  dedupPending: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface InseeStatus {
  isSyncing: boolean;
  totalInseeProfiles: number;
  recentJobs: InseeJob[];
}

async function fetchInseeStatus(token: string): Promise<InseeStatus> {
  const response = await fetch(`${API_URL}/admin/integrations/insee/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch status');
  }

  return response.json();
}

async function syncMonth(token: string, yearMonth: string): Promise<unknown> {
  const response = await fetch(`${API_URL}/admin/integrations/insee/sync/month`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ yearMonth }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Sync failed');
  }

  return response.json();
}

async function stopSync(token: string): Promise<unknown> {
  const response = await fetch(`${API_URL}/admin/integrations/insee/sync/stop`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Stop failed');
  }

  return response.json();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function StatusBadge({ status }: { status: InseeJob['status'] }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
          <XCircle className="w-3 h-3" />
          Failed
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
          <Ban className="w-3 h-3" />
          Stopped
        </span>
      );
    case 'RUNNING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Running
        </span>
      );
  }
}

// Generate year options (current year back to 2020)
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

const months = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export default function IntegrationsPage() {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState('12');

  const { data: status, isLoading } = useQuery({
    queryKey: ['admin', 'insee', 'status', token],
    queryFn: () => fetchInseeStatus(token!),
    enabled: !!token,
    refetchInterval: 5000, // Poll every 5 seconds when syncing
    retry: false, // Don't retry on 401
  });

  const syncMutation = useMutation({
    mutationFn: () => syncMonth(token!, `${selectedYear}${selectedMonth}`),
    onSuccess: () => {
      toast.success('Sync started successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'insee', 'status'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => stopSync(token!),
    onSuccess: () => {
      toast.success('Stop signal sent - sync will stop after current batch');
      queryClient.invalidateQueries({ queryKey: ['admin', 'insee', 'status'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSync = () => {
    syncMutation.mutate();
  };

  const handleStop = () => {
    stopMutation.mutate();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Manage external data sources and synchronization
        </p>
      </div>

      {/* INSEE Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">INSEE / matchID</h2>
                <p className="text-sm text-muted-foreground">
                  French national death records
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">
                {isLoading ? '--' : status?.totalInseeProfiles.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Total profiles</p>
            </div>
          </div>
        </div>

        {/* Sync Form */}
        <div className="p-6 border-b border-border bg-accent/30">
          <h3 className="font-medium mb-4">Sync Data</h3>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending || status?.isSyncing}
            >
              {(syncMutation.isPending || status?.isSyncing) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              Sync {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Imports death records for the selected month from the French national registry (via matchID API).
          </p>
        </div>

        {/* Active Job Progress */}
        {status?.recentJobs.find((j) => j.status === 'RUNNING') && (
          <div className="p-6 border-b border-border bg-blue-500/5">
            {(() => {
              const runningJob = status.recentJobs.find((j) => j.status === 'RUNNING')!;
              const elapsedTime = Date.now() - new Date(runningJob.startedAt).getTime();
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      <div>
                        <h3 className="font-medium">Syncing {runningJob.fileMonth}</h3>
                        <p className="text-sm text-muted-foreground">
                          Processing records from matchID API...
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Elapsed</p>
                      <p className="font-mono text-lg">{formatDuration(elapsedTime)}</p>
                    </div>
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-card rounded-lg p-4 border border-border">
                      <p className="text-sm text-muted-foreground">Processed</p>
                      <p className="text-2xl font-semibold font-mono">
                        {runningJob.processedCount.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border">
                      <p className="text-sm text-muted-foreground">New Profiles</p>
                      <p className="text-2xl font-semibold font-mono text-green-500">
                        +{runningJob.newProfiles.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border">
                      <p className="text-sm text-muted-foreground">Duplicates Skipped</p>
                      <p className="text-2xl font-semibold font-mono text-muted-foreground">
                        {(runningJob.processedCount - runningJob.newProfiles).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Activity Indicator & Stop Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </div>
                      <span>Live updates every 5 seconds</span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleStop}
                      disabled={stopMutation.isPending}
                    >
                      {stopMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <StopCircle className="w-4 h-4 mr-2" />
                      )}
                      Stop Sync
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Recent Jobs */}
        <div className="p-6">
          <h3 className="font-medium mb-4">Recent Sync Jobs</h3>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : status?.recentJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync jobs yet. Start your first sync above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">Period</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Records</th>
                    <th className="text-right py-3 px-4 font-medium">New</th>
                    <th className="text-right py-3 px-4 font-medium">Skipped</th>
                    <th className="text-left py-3 px-4 font-medium">Started</th>
                    <th className="text-left py-3 px-4 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {status?.recentJobs.map((job) => (
                    <tr 
                      key={job.id} 
                      className={`border-b border-border/50 ${
                        job.status === 'RUNNING' ? 'bg-blue-500/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-medium">{job.fileMonth}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {job.processedCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-green-500 font-mono">
                        +{job.newProfiles.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground font-mono">
                        {(job.processedCount - job.newProfiles).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(job.startedAt)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono">
                        {job.completedAt
                          ? formatDuration(
                              new Date(job.completedAt).getTime() -
                                new Date(job.startedAt).getTime()
                            )
                          : (
                            <span className="text-blue-500">
                              {formatDuration(Date.now() - new Date(job.startedAt).getTime())}
                            </span>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

