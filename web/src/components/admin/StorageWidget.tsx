import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HardDrive, Folder, File, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// R2 free tier: 10 GB, Pro: 10 TB. Using 10 GB as default display limit.
const STORAGE_LIMIT_GB = 10;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getUsageColor(pct: number): string {
  if (pct < 50) return 'bg-emerald-500';
  if (pct < 75) return 'bg-amber-500';
  return 'bg-red-500';
}

export function StorageWidget() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-storage-stats'],
    queryFn: () => api.getStorageStats(),
    refetchInterval: 60_000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading storage info...
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const usedGB = stats.totalSize / (1024 * 1024 * 1024);
  const pct = Math.min((usedGB / STORAGE_LIMIT_GB) * 100, 100);
  const remainingGB = Math.max(STORAGE_LIMIT_GB - usedGB, 0);

  // Sort folders by size descending
  const sortedFolders = Object.entries(stats.folders)
    .sort(([, a], [, b]) => b.size - a.size);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-muted-foreground" />
          R2 Storage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage bar */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-bold text-foreground">
              {formatBytes(stats.totalSize)}
            </span>
            <span className="text-sm text-muted-foreground">
              of {STORAGE_LIMIT_GB} GB
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', getUsageColor(pct))}
              style={{ width: `${Math.max(pct, 1)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">
              {pct.toFixed(1)}% used
            </span>
            <span className="text-xs text-muted-foreground">
              {formatBytes(stats.totalSize * (1024 * 1024 * 1024) / (1024 * 1024 * 1024))} remaining
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <File className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Files</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{stats.totalFiles}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Folder className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Folders</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{sortedFolders.length}</p>
          </div>
        </div>

        {/* Folder breakdown */}
        {sortedFolders.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              By Folder
            </p>
            <div className="space-y-2">
              {sortedFolders.map(([name, info]) => {
                const folderPct = stats.totalSize > 0
                  ? (info.size / stats.totalSize) * 100
                  : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-foreground font-medium truncate">{name}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">
                        {info.count} files · {formatBytes(info.size)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${Math.max(folderPct, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
