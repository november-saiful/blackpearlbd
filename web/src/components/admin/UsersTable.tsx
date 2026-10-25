import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, ChevronLeft, ChevronRight, Users, Edit, Trash2, Loader2, Shield, Star } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { formatDate, getTierColor } from '@/lib/utils';
import { useAdminUsers } from '@/hooks/useAdmin';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import type { Profile } from '@/types';

export function UsersTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { users, total, totalPages, isLoading, updateUser, deleteUser, isUpdating, isDeleting } = useAdminUsers(page, search);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'user' as string,
    status: 'bronze' as string,
    pearls: 0,
  });

  const openEditModal = (user: Profile) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name || '',
      role: user.role,
      status: user.status,
      pearls: user.pearls,
    });
    setIsEditModalOpen(true);
  };

  const openDeleteConfirm = (user: Profile) => {
    setSelectedUser(user);
    setIsDeleteConfirmOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedUser) return;
    updateUser({
      id: selectedUser.id,
      data: {
        full_name: formData.full_name,
        role: formData.role,
        status: formData.status,
        pearls: formData.pearls,
      },
    });
    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    deleteUser(selectedUser.id);
    setIsDeleteConfirmOpen(false);
    setSelectedUser(null);
  };

  // Client-side filtering for role/status (since backend only supports search)
  const filteredUsers = users.filter((user) => {
    if (roleFilter && roleFilter !== 'all' && user.role !== roleFilter) return false;
    if (statusFilter && statusFilter !== 'all' && user.status !== statusFilter) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            Users ({total})
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 w-full sm:w-56"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="diamond">Diamond</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton columns={7} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Email</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Pearls</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Joined</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border last:border-0 hover:bg-white/45 dark:hover:bg-white/10 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="glass-soft w-8 h-8 rounded-lg flex items-center justify-center">
                              <Users className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{user.full_name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground truncate sm:hidden">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground hidden sm:table-cell">{user.email}</td>
                      <td className="py-3 px-3">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs gap-1">
                          {user.role === 'admin' && <Shield className="w-3 h-3" />}
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          {user.pearls}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge className={cn('text-xs', getTierColor(user.status))}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground hidden lg:table-cell">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditModal(user)}
                            title="Edit user"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => openDeleteConfirm(user)}
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit User
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="glass-chip flex items-center gap-3 p-3 rounded-lg">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="glass-soft w-10 h-10 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{selectedUser.full_name || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div>
                <Label>Full Name</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="User's full name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tier / Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="platinum">Platinum</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="diamond">Diamond</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Pearls</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.pearls}
                  onChange={(e) => setFormData({ ...formData, pearls: Math.max(0, Number(e.target.value)) })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Adjust the user's pearl balance directly
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditModalOpen(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDeleteConfirmOpen(false);
          setSelectedUser(null);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete User
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to permanently delete this user?
              </p>
              <div className="glass-chip p-3 rounded-lg">
                <p className="text-sm font-medium">{selectedUser.full_name || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
              <p className="text-xs text-destructive font-medium">
                This action cannot be undone. All associated data will be removed.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeleteConfirmOpen(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
