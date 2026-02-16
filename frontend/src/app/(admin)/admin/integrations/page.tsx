'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, CheckCircle2, XCircle, Loader2, Calendar, StopCircle, Ban,
  Download, FileArchive, Globe, HardDrive, Search
} from 'lucide-react';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

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

interface LocalFile {
  fileName: string;
  size: number;
  processed: boolean;
}

interface NewFileInfo {
  fileName: string;
  url: string;
  month: string;
  year: string;
  type: 'monthly' | 'annual' | 'decennial';
}

interface InseeStatus {
  isSyncing: boolean;
  currentJobId: string | null;
  totalInseeProfiles: number;
  localFiles: LocalFile[];
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

async function checkForNewFiles(token: string): Promise<{ count: number; files: NewFileInfo[] }> {
  const response = await fetch(`${API_URL}/admin/integrations/insee/files/check`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to check for new files');
  }

  return response.json();
}

async function syncLocalFile(token: string, fileName: string): Promise<unknown> {
  const response = await fetch(`${API_URL}/admin/integrations/insee/files/sync/${encodeURIComponent(fileName)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Sync failed');
  }

  return response.json();
}

async function downloadAndSyncNew(token: string): Promise<unknown> {
  const response = await fetch(`${API_URL}/admin/integrations/insee/files/download`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Download failed');
  }

  return response.json();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [newFilesData, setNewFilesData] = useState<{ count: number; files: NewFileInfo[] } | null>(null);

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

  const checkFilesMutation = useMutation({
    mutationFn: () => checkForNewFiles(token!),
    onSuccess: (data) => {
      setNewFilesData(data);
      if (data.count === 0) {
        toast.info('No new files available on INSEE website');
      } else {
        toast.success(`Found ${data.count} new file(s) available`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const syncLocalFileMutation = useMutation({
    mutationFn: (fileName: string) => syncLocalFile(token!, fileName),
    onSuccess: () => {
      toast.success('File sync completed');
      queryClient.invalidateQueries({ queryKey: ['admin', 'insee', 'status'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const downloadSyncMutation = useMutation({
    mutationFn: () => downloadAndSyncNew(token!),
    onSuccess: () => {
      toast.success('Download and sync completed');
      setNewFilesData(null);
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
                <h2 className="text-lg font-semibold">INSEE Death Records</h2>
                <p className="text-sm text-muted-foreground">
                  French national death records from insee.fr
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

        {/* Sync Methods Tabs */}
        <Tabs defaultValue="direct" className="w-full">
          <div className="border-b border-border px-6 pt-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="direct" className="gap-2">
                <Globe className="w-4 h-4" />
                Direct from INSEE
              </TabsTrigger>
              <TabsTrigger value="api" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                matchID API
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Direct INSEE Sync Tab */}
          <TabsContent value="direct" className="mt-0">
            <div className="p-6 border-b border-border bg-accent/30">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-medium">Sync from INSEE Website</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Download official death record files directly from insee.fr. Files are checked daily at 4 AM.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => checkFilesMutation.mutate()}
                    disabled={checkFilesMutation.isPending || status?.isSyncing}
                  >
                    {checkFilesMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Check for New Files
                  </Button>
                  {newFilesData && newFilesData.count > 0 && (
                    <Button
                      onClick={() => downloadSyncMutation.mutate()}
                      disabled={downloadSyncMutation.isPending || status?.isSyncing}
                    >
                      {downloadSyncMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Download & Sync
                    </Button>
                  )}
                </div>
              </div>

              {/* New Files Available */}
              {newFilesData && newFilesData.count > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-green-600 mb-2">
                    {newFilesData.count} New File(s) Available
                  </h4>
                  <div className="space-y-2">
                    {newFilesData.files.slice(0, 5).map((file) => (
                      <div key={file.fileName} className="flex items-center justify-between text-sm">
                        <span className="font-mono">{file.fileName}</span>
                        <span className="text-muted-foreground">
                          {file.type === 'monthly' ? `${file.month}` : file.year}
                        </span>
                      </div>
                    ))}
                    {newFilesData.files.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        ...and {newFilesData.files.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Local Files */}
              {status?.localFiles && status.localFiles.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    Local Files ({status.localFiles.length})
                  </h4>
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left py-2 px-4 font-medium">File Name</th>
                          <th className="text-right py-2 px-4 font-medium">Size</th>
                          <th className="text-center py-2 px-4 font-medium">Status</th>
                          <th className="text-right py-2 px-4 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {status.localFiles.map((file) => (
                          <tr key={file.fileName} className="border-b border-border/50">
                            <td className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <FileArchive className="w-4 h-4 text-muted-foreground" />
                                <span className="font-mono text-xs">{file.fileName}</span>
                              </div>
                            </td>
                            <td className="py-2 px-4 text-right text-muted-foreground">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="py-2 px-4 text-center">
                              {file.processed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-500">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Processed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-500">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-right">
                              {!file.processed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => syncLocalFileMutation.mutate(file.fileName)}
                                  disabled={syncLocalFileMutation.isPending || status?.isSyncing}
                                >
                                  {syncLocalFileMutation.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    'Process'
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(!status?.localFiles || status.localFiles.length === 0) && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <FileArchive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No local files found in sync-data directory</p>
                  <p className="text-sm mt-1">Click "Check for New Files" to find available downloads</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* matchID API Tab */}
          <TabsContent value="api" className="mt-0">
            <div className="p-6 border-b border-border bg-accent/30">
              <h3 className="font-medium mb-4">Sync via matchID API</h3>
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
                Imports death records for the selected month from the French national registry via the matchID API.
                This method is slower but provides geocoded coordinates.
              </p>
            </div>
          </TabsContent>
        </Tabs>

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

