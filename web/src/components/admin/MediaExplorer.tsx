import { useState, useCallback } from 'react';
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
} from 'lucide-react';
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

function isImage(contentType: string | undefined | null): boolean {
  return !!contentType && contentType.startsWith('image/');
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
      // This is inside a subfolder
      const folder = relative.slice(0, slashIndex + 1);
      folders.add(folder);
    } else {
      fileItems.push(file);
    }
  }

  const navigateTo = useCallback(
    (newPrefix: string) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPrefix);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setPrefix(newPrefix);
      setCursor(undefined);
    },
    [history, historyIndex],
  );

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPrefix(history[newIndex]);
      setCursor(undefined);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPrefix(history[newIndex]);
      setCursor(undefined);
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
        </div>
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
                {Array.from(folders).map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => navigateTo(prefix + folder)}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:bg-accent/50 transition-colors text-center"
                  >
                    <Folder className="w-10 h-10 text-amber-500 shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate w-full">
                      {folder.replace(/\/$/, '')}
                    </span>
                  </button>
                ))}

                {/* Files */}
                {fileItems.map((file) => (
                  <div
                    key={file.key}
                    className={cn(
                      'group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-colors cursor-pointer hover:border-primary/50',
                      selectedFile?.key === file.key && 'border-primary ring-1 ring-primary/20',
                    )}
                    onClick={() => setSelectedFile(file)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {isImage(file.httpMetadata?.contentType) ? (
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
                    <div className="p-2">
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
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Type</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Size</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Uploaded</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Folders */}
                    {Array.from(folders).map((folder) => (
                      <tr
                        key={folder}
                        className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigateTo(prefix + folder)}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                            <span className="text-sm font-medium text-foreground">
                              {folder.replace(/\/$/, '')}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 hidden sm:table-cell text-sm text-muted-foreground">Folder</td>
                        <td className="py-3 px-3 hidden md:table-cell text-sm text-muted-foreground">—</td>
                        <td className="py-3 px-3 hidden lg:table-cell text-sm text-muted-foreground">—</td>
                        <td className="py-3 px-3"></td>
                      </tr>
                    ))}

                    {/* Files */}
                    {fileItems.map((file) => (
                      <tr
                        key={file.key}
                        className={cn(
                          'border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer',
                          selectedFile?.key === file.key && 'bg-accent/50',
                        )}
                        onClick={() => setSelectedFile(file)}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {isImage(file.httpMetadata?.contentType) ? (
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
                          {file.httpMetadata.contentType}
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
                    ))}
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
                {isImage(selectedFile.httpMetadata?.contentType) ? (
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
                    <span className="text-foreground">{selectedFile.httpMetadata.contentType}</span>
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
      </CardContent>
    </Card>
  );
}
