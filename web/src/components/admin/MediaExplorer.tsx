import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderInput,
  Image,
  File,
  Trash2,
  Pencil,
  Search,
  X,
  ExternalLink,
  Copy,
  Loader2,
  Grid,
  List,
  Check,
  Square,
  CheckSquare,
  PenLine,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { MediaFile } from '@/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'bmp', 'ico'];

/**
 * Whether an R2 object is an image. Content type is preferred, but objects
 * uploaded by older flows can carry no metadata at all, so fall back to the
 * file extension rather than treating every one of them as a binary blob.
 */
function isImage(contentType: string | undefined | null, key?: string): boolean {
  if (contentType && contentType.startsWith('image/')) return true;
  if (!contentType || contentType === 'application/octet-stream') {
    if (key && IMAGE_EXTENSIONS.includes(fileExtension(key))) return true;
  }
  return false;
}

function fileExtension(key: string): string {
  const parts = key.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function fileName(key: string): string {
  const parts = key.split('/');
  return parts[parts.length - 1];
}

function folderPath(key: string): string {
  const parts = key.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Whether a folder may be deleted. One segment ("deals/") is a whole namespace
 * where deletion would take every deal image at once, so it is not offered —
 * matching the endpoint, which refuses it.
 */
function canDeleteFolder(prefix: string): boolean {
  return prefix.split('/').filter(Boolean).length >= 2;
}

export function MediaExplorer() {
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  // Prefix of the folder currently being deleted, so its own button can spin.
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  // The folder queued for deletion, and whether the deals pointing into it
  // should have those references cleared as part of the delete.
  const [folderToDelete, setFolderToDelete] = useState<{ prefix: string; name: string } | null>(null);
  const [unlinkReferences, setUnlinkReferences] = useState(true);
  // Batch selection
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  // Batch rename dialog
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);
  const [batchFind, setBatchFind] = useState('');
  const [batchReplace, setBatchReplace] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-media', prefix, cursor],
    queryFn: () => api.listMedia({ prefix: prefix || undefined, cursor, limit: 50 }),
  });

  const files = data?.files || [];
  const truncated = data?.truncated || false;
  const nextCursor = data?.cursor || null;

  // Separate folders and files
  const folders = new Set<string>();
  const fileItems: MediaFile[] = [];

  for (const file of files) {
    const relative = prefix ? file.key.slice(prefix.length) : file.key;
    const slashIndex = relative.indexOf('/');
    if (slashIndex !== -1) {
      const folder = relative.slice(0, slashIndex + 1);
      folders.add(folder);
    } else {
      fileItems.push(file);
    }
  }

  const allSelected = fileItems.length > 0 && fileItems.every((f) => selectedKeys.has(f.key));
  const someSelected = fileItems.some((f) => selectedKeys.has(f.key));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const f of fileItems) next.delete(f.key);
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const f of fileItems) next.add(f.key);
        return next;
      });
    }
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const navigateTo = useCallback(
    (newPrefix: string) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPrefix);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setPrefix(newPrefix);
      setCursor(undefined);
      clearSelection();
    },
    [history, historyIndex],
  );

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPrefix(history[newIndex]);
      setCursor(undefined);
      clearSelection();
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPrefix(history[newIndex]);
      setCursor(undefined);
      clearSelection();
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (key: string) => api.deleteMedia(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      toast.success('File deleted');
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete file');
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ oldKey, newKey }: { oldKey: string; newKey: string }) =>
      api.renameMedia(oldKey, newKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      toast.success('File renamed');
      setRenaming(null);
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to rename file');
    },
  });

  // Batch mutations
  const batchDeleteMutation = useMutation({
    mutationFn: (keys: string[]) => api.batchDeleteMedia(keys),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      queryClient.invalidateQueries({ queryKey: ['admin-storage-stats'] });
      toast.success(`Deleted ${result.deleted} file${result.deleted !== 1 ? 's' : ''}`);
      clearSelection();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete files');
    },
  });

  const batchRenameMutation = useMutation({
    mutationFn: ({ keys, find, replace }: { keys: string[]; find: string; replace: string }) =>
      api.batchRenameMedia(keys, find, replace),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      toast.success(`Renamed ${result.renamed} file${result.renamed !== 1 ? 's' : ''}${result.errors > 0 ? ` (${result.errors} errors)` : ''}`);
      clearSelection();
      setBatchRenameOpen(false);
      setBatchFind('');
      setBatchReplace('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to rename files');
    },
  });

  const handleRename = (file: MediaFile) => {
    const name = fileName(file.key);
    setRenaming(file.key);
    setNewName(name);
  };

  const confirmRename = (file: MediaFile) => {
    if (!newName.trim() || newName === fileName(file.key)) {
      setRenaming(null);
      return;
    }
    const folder = folderPath(file.key);
    const newKey = folder ? `${folder}/${newName.trim()}` : newName.trim();
    renameMutation.mutate({ oldKey: file.key, newKey });
  };

  const handleDelete = (key: string) => {
    if (confirm('Permanently delete this file? This cannot be undone.')) {
      setDeleting(key);
      deleteMutation.mutate(key);
      setTimeout(() => setDeleting(null), 1000);
    }
  };

  /**
   * Deletes a folder and everything inside it. R2 folders are just key
   * prefixes, so `folderPrefix` is always the path up to and including its
   * trailing slash.
   */
  // What the queued folder holds, and which deals still point into it. Fetched
  // when the dialog opens so the warning can name them instead of guessing.
  const {
    data: folderUsage,
    isFetching: isCheckingUsage,
    error: usageError,
  } = useQuery({
    queryKey: ['media-folder-usage', folderToDelete?.prefix],
    queryFn: () => api.getMediaFolderUsage(folderToDelete!.prefix),
    enabled: !!folderToDelete,
  });

  const affectedDeals = folderUsage?.deals ?? [];
  // An unanswered check is not the same as "nothing uses this folder", so the
  // dialog says so and holds the delete back rather than implying it is safe.
  const usageUnknown = !!usageError || (!isCheckingUsage && !folderUsage);

  const deleteFolderMutation = useMutation({
    mutationFn: ({ prefix, unlink }: { prefix: string; unlink: boolean }) =>
      api.deleteMediaFolder(prefix, unlink),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      queryClient.invalidateQueries({ queryKey: ['admin-storage-stats'] });
      // Clearing references rewrote deal rows, so anything showing a deal needs
      // to be refetched too.
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal'] });

      const unlinked = result.unlinkedDeals ?? 0;
      toast.success(
        `Folder deleted with ${result.deleted} file${result.deleted !== 1 ? 's' : ''}` +
          (unlinked > 0 ? ` · ${unlinked} deal${unlinked !== 1 ? 's' : ''} updated` : ''),
      );
      setFolderToDelete(null);
      setDeletingFolder(null);
      clearSelection();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete folder');
      setDeletingFolder(null);
    },
  });

  /**
   * Opens the deletion dialog rather than a bare confirm: the folder's usage has
   * to be known before the admin can be told what breaks.
   */
  const handleDeleteFolder = (folderPrefix: string, name: string) => {
    setUnlinkReferences(true);
    setFolderToDelete({ prefix: folderPrefix, name });
  };

  const handleBatchDelete = () => {
    const count = selectedKeys.size;
    if (count === 0) return;
    if (!confirm(`Permanently delete ${count} file${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    batchDeleteMutation.mutate(Array.from(selectedKeys));
  };

  const handleBatchRename = () => {
    if (!batchFind.trim()) {
      toast.error('Search text is required');
      return;
    }
    batchRenameMutation.mutate({
      keys: Array.from(selectedKeys),
      find: batchFind,
      replace: batchReplace,
    });
  };

  const reorganizeMutation = useMutation({
    mutationFn: () => api.reorganizeMedia(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      queryClient.invalidateQueries({ queryKey: ['admin-storage-stats'] });
      toast.success(`Reorganized: ${result.moved} files moved, ${result.skipped} skipped`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reorganize');
    },
  });

  const apiUrl = import.meta.env.VITE_API_URL || '';

  const copyUrl = (file: MediaFile) => {
    const url = `${apiUrl}/upload/image/${encodeURIComponent(file.key)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('URL copied to clipboard'),
      () => toast.error('Failed to copy URL'),
    );
  };

  const fileUrl = (file: MediaFile) => `${apiUrl}/upload/image/${encodeURIComponent(file.key)}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Folder className="w-5 h-5 text-muted-foreground" />
            Media Files
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={reorganizeMutation.isPending}
              onClick={() => {
                if (confirm('Move all root-level deal images into their deal-slug subfolders? This updates database references too.')) {
                  reorganizeMutation.mutate();
                }
              }}
            >
              {reorganizeMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <FolderInput className="w-3.5 h-3.5 mr-1.5" />
              )}
              {reorganizeMutation.isPending ? 'Organizing...' : 'Reorganize'}
            </Button>
            <div className="flex items-center gap-1 border border-border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-1 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={historyIndex === 0}
            onClick={goBack}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={historyIndex >= history.length - 1}
            onClick={goForward}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-muted-foreground">/</span>
          {prefix.split('/').filter(Boolean).map((part, i, arr) => {
            const path = arr.slice(0, i + 1).join('/') + '/';
            return (
              <span key={path} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateTo(path)}
                  className="text-primary hover:underline font-medium"
                >
                  {part}
                </button>
                <span className="text-muted-foreground">/</span>
              </span>
            );
          })}
          {/*
           * Deleting the folder you are standing in. The tiles below can only
           * delete subfolders, so without this the parent would have to be
           * re-entered just to remove the one you are looking at.
           */}
          {canDeleteFolder(prefix) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-7 px-2 text-xs text-destructive hover:text-destructive"
              disabled={deletingFolder === prefix}
              onClick={() => {
                const name = prefix.replace(/\/$/, '').split('/').pop() || prefix;
                handleDeleteFolder(prefix, name);
              }}
            >
              {deletingFolder === prefix ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              Delete this folder
            </Button>
          )}
        </div>

        {/* Batch action bar */}
        {selectedKeys.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-2 mt-1">
            <span className="text-sm font-medium text-primary">
              {selectedKeys.size} file{selectedKeys.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={batchRenameMutation.isPending}
                onClick={() => {
                  setBatchFind('');
                  setBatchReplace('');
                  setBatchRenameOpen(true);
                }}
              >
                <PenLine className="w-3 h-3 mr-1" />
                Rename…
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                disabled={batchDeleteMutation.isPending}
                onClick={handleBatchDelete}
              >
                {batchDeleteMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3 mr-1" />
                )}
                Delete
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Batch rename dialog */}
        {batchRenameOpen && (
          <div className="rounded-lg bg-muted border border-border p-4 mt-1 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Batch rename {selectedKeys.size} file{selectedKeys.size !== 1 ? 's' : ''} — find &amp; replace in filename
              </p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBatchRenameOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Find</label>
                <Input
                  value={batchFind}
                  onChange={(e) => setBatchFind(e.target.value)}
                  placeholder="e.g. IMG_"
                  className="h-8 text-xs"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Replace with</label>
                <Input
                  value={batchReplace}
                  onChange={(e) => setBatchReplace(e.target.value)}
                  placeholder="e.g. hero-"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setBatchRenameOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!batchFind.trim() || batchRenameMutation.isPending}
                onClick={handleBatchRename}
              >
                {batchRenameMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Rename
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading files...
          </div>
        ) : folders.size === 0 && fileItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No files found{prefix ? ` in ${prefix}` : ''}</p>
          </div>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* Folders */}
                {Array.from(folders).map((folder) => {
                  const folderPrefix = prefix + folder;
                  const folderName = folder.replace(/\/$/, '');
                  return (
                    <div key={folder} className="relative">
                      <button
                        type="button"
                        onClick={() => navigateTo(folderPrefix)}
                        className="flex w-full flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:bg-accent/50 transition-colors text-center"
                      >
                        <Folder className="w-10 h-10 text-amber-500 shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate w-full">
                          {folderName}
                        </span>
                      </button>
                      {/*
                       * Always visible, not revealed on hover: a control that
                       * only exists under the pointer is invisible on a touch
                       * screen and easy to miss with a mouse. A top-level folder
                       * has none, since deleting it would take a whole namespace.
                       */}
                      {canDeleteFolder(folderPrefix) && (
                        <button
                          type="button"
                          title={`Delete folder ${folderName}`}
                          aria-label={`Delete folder ${folderName} and all of its files`}
                          disabled={deletingFolder === folderPrefix}
                          onClick={() => handleDeleteFolder(folderPrefix, folderName)}
                          className="absolute right-2 top-2 rounded-md border border-border bg-background/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {deletingFolder === folderPrefix ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Files */}
                {fileItems.map((file) => {
                  const isSelected = selectedKeys.has(file.key);
                  return (
                    <div
                      key={file.key}
                      className={cn(
                        'group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-colors cursor-pointer hover:border-primary/50',
                        selectedFile?.key === file.key && 'border-primary ring-1 ring-primary/20',
                        isSelected && 'border-primary/60 bg-primary/5',
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        className={cn(
                          'absolute top-2 left-2 z-10 rounded-md p-0.5 transition-opacity',
                          isSelected
                            ? 'opacity-100 bg-primary text-primary-foreground'
                            : 'opacity-0 group-hover:opacity-100 bg-background/80 text-muted-foreground hover:text-foreground',
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(file.key);
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      {/* Thumbnail */}
                      <div
                        className="aspect-square bg-muted flex items-center justify-center overflow-hidden"
                        onClick={() => !isSelected && setSelectedFile(file)}
                      >
                        {isImage(file.httpMetadata?.contentType, file.key) ? (
                          <img
                            src={fileUrl(file)}
                            alt={fileName(file.key)}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <File className="w-10 h-10 text-muted-foreground/40" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2" onClick={() => !isSelected && setSelectedFile(file)}>
                        <p className="text-xs font-medium text-foreground truncate">
                          {fileName(file.key)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>

                      {/* Quick actions overlay */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyUrl(file);
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 shadow-sm"
                          disabled={deleting === file.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file.key);
                          }}
                        >
                          {deleting === file.key ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="flex items-center justify-center w-full"
                          title={allSelected ? 'Deselect all' : 'Select all'}
                        >
                          {allSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : someSelected ? (
                            <div className="w-4 h-4 rounded border border-primary bg-primary/20 flex items-center justify-center">
                              <div className="w-2 h-0.5 bg-primary rounded" />
                            </div>
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Type</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Size</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Uploaded</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Folders */}
                    {Array.from(folders).map((folder) => {
                      const folderPrefix = prefix + folder;
                      const folderName = folder.replace(/\/$/, '');
                      return (
                        <tr
                          key={folder}
                          className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigateTo(folderPrefix)}
                        >
                          <td className="py-3 px-3"></td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                              <span className="text-sm font-medium text-foreground">
                                {folderName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 hidden sm:table-cell text-sm text-muted-foreground">Folder</td>
                          <td className="py-3 px-3 hidden md:table-cell text-sm text-muted-foreground">—</td>
                          <td className="py-3 px-3 hidden lg:table-cell text-sm text-muted-foreground">—</td>
                          <td className="py-3 px-3">
                            <div className="flex justify-end">
                              {canDeleteFolder(folderPrefix) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  title={`Delete folder ${folderName}`}
                                  aria-label={`Delete folder ${folderName} and all of its files`}
                                  disabled={deletingFolder === folderPrefix}
                                  onClick={(event) => {
                                    // The row itself navigates; deleting must not.
                                    event.stopPropagation();
                                    handleDeleteFolder(folderPrefix, folderName);
                                  }}
                                >
                                  {deletingFolder === folderPrefix ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Files */}
                    {fileItems.map((file) => {
                      const isSelected = selectedKeys.has(file.key);
                      return (
                        <tr
                          key={file.key}
                          className={cn(
                            'border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer',
                            selectedFile?.key === file.key && 'bg-accent/50',
                            isSelected && 'bg-primary/5',
                          )}
                          onClick={() => setSelectedFile(file)}
                        >
                          <td
                            className="py-3 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSelect(file.key)}
                              className="flex items-center justify-center"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {isImage(file.httpMetadata?.contentType, file.key) ? (
                                <div className="h-9 w-9 rounded-lg bg-muted overflow-hidden shrink-0">
                                  <img
                                    src={fileUrl(file)}
                                    alt={fileName(file.key)}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              ) : (
                                <File className="w-5 h-5 text-muted-foreground shrink-0" />
                              )}
                              <div className="min-w-0">
                                {renaming === file.key ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                      value={newName}
                                      onChange={(e) => setNewName(e.target.value)}
                                      className="h-7 text-xs w-40"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') confirmRename(file);
                                        if (e.key === 'Escape') setRenaming(null);
                                      }}
                                      onBlur={() => confirmRename(file)}
                                    />
                                  </div>
                                ) : (
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {fileName(file.key)}
                                  </p>
                                )}
                                <p className="text-[10px] text-muted-foreground truncate">{file.key}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 hidden sm:table-cell text-sm text-muted-foreground">
                            {file.httpMetadata?.contentType}
                          </td>
                          <td className="py-3 px-3 hidden md:table-cell text-sm text-muted-foreground">
                            {formatFileSize(file.size)}
                          </td>
                          <td className="py-3 px-3 hidden lg:table-cell text-sm text-muted-foreground">
                            {file.uploaded
                              ? new Date(file.uploaded).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(fileUrl(file), '_blank')}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyUrl(file)}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRename(file)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={deleting === file.key}
                                onClick={() => handleDelete(file.key)}
                              >
                                {deleting === file.key ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Load more for truncated results */}
            {truncated && nextCursor && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => setCursor(nextCursor)}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}

        {/* File preview panel */}
        {selectedFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {/* Preview header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {fileName(selectedFile.key)}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">{selectedFile.key}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Preview image */}
              <div className="bg-muted">
                {isImage(selectedFile.httpMetadata?.contentType, selectedFile.key) ? (
                  <img
                    src={fileUrl(selectedFile)}
                    alt={fileName(selectedFile.key)}
                    className="w-full max-h-[50vh] object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-48">
                    <File className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Preview details & actions */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{' '}
                    <span className="text-foreground">{selectedFile.httpMetadata?.contentType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Size:</span>{' '}
                    <span className="text-foreground">{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Key:</span>{' '}
                    <span className="text-foreground font-mono text-[10px]">{selectedFile.key}</span>
                  </div>
                  {selectedFile.uploaded && (
                    <div>
                      <span className="text-muted-foreground">Uploaded:</span>{' '}
                      <span className="text-foreground">
                        {new Date(selectedFile.uploaded).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(fileUrl(selectedFile), '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Open
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyUrl(selectedFile)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy URL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleRename(selectedFile);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Rename
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={deleting === selectedFile.key}
                    onClick={() => handleDelete(selectedFile.key)}
                  >
                    {deleting === selectedFile.key ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/*
         * Folder deletion. Portalled by Radix, so its place in the tree does
         * not matter; what does is that the deals still pointing into the
         * folder are named before anything is removed.
         */}
        <Dialog
          open={!!folderToDelete}
          onOpenChange={(open) => {
            if (!open) {
              setFolderToDelete(null);
              setDeletingFolder(null);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Delete folder "{folderToDelete?.name}"?</DialogTitle>
              <DialogDescription>
                Every file inside it is permanently removed from storage. This cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {isCheckingUsage ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking what uses this folder…
              </div>
            ) : usageUnknown ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-center text-xs text-destructive">
                  Could not check what uses this folder
                  {usageError instanceof Error && usageError.message
                    ? `: ${usageError.message}`
                    : '.'}
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Deleting now could leave deals with broken photos. Close this and try again.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  {folderUsage?.fileCount ?? 0} file
                  {(folderUsage?.fileCount ?? 0) === 1 ? '' : 's'} in{' '}
                  <span className="font-mono text-xs">{folderUsage?.prefix ?? folderToDelete?.prefix}</span>
                </p>

                {affectedDeals.length > 0 ? (
                  <>
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Still used by {affectedDeals.length} deal
                        {affectedDeals.length === 1 ? '' : 's'}
                      </p>
                      <p className="mt-1 text-xs text-destructive/80">
                        They point at {folderUsage?.totalImages ?? 0} image
                        {(folderUsage?.totalImages ?? 0) === 1 ? '' : 's'} in this folder, which
                        would stop showing.
                      </p>
                      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                        {affectedDeals.map((deal) => (
                          <li
                            key={deal.id}
                            className="flex items-center justify-between gap-3 text-xs text-foreground"
                          >
                            <span className="truncate">{deal.title}</span>
                            <span className="shrink-0 text-muted-foreground">
                              {deal.imageCount} image{deal.imageCount === 1 ? '' : 's'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/*
                     * The safety net: without this the delete would leave
                     * those deals with broken photos. On by default, because
                     * that is the outcome that keeps the site correct.
                     */}
                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={unlinkReferences}
                        onChange={(event) => setUnlinkReferences(event.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
                      />
                      <span>
                        Also remove these images from those deals, so their galleries and main
                        images don't point at deleted files.
                      </span>
                    </label>

                    {!unlinkReferences && (
                      <p className="text-xs text-destructive">
                        Those deals would be left with broken photos. Tick the box to continue, or
                        cancel.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No deal references this folder, so nothing else needs updating.
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                disabled={deleteFolderMutation.isPending}
                onClick={() => setFolderToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  isCheckingUsage ||
                  usageUnknown ||
                  deleteFolderMutation.isPending ||
                  // A referenced folder cannot be removed while the box is
                  // unticked: the server refuses it anyway.
                  (affectedDeals.length > 0 && !unlinkReferences)
                }
                onClick={() => {
                  if (!folderToDelete) return;
                  setDeletingFolder(folderToDelete.prefix);
                  deleteFolderMutation.mutate({
                    prefix: folderToDelete.prefix,
                    unlink: unlinkReferences && affectedDeals.length > 0,
                  });
                }}
              >
                {deleteFolderMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'Delete folder'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
