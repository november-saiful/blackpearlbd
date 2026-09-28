import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon';
import { cn } from '@/lib/utils';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { useAdminCustomPackages } from '@/hooks/useAdmin';

export function CustomPackagesManager() {
  const [page, setPage] = useState(1);
  const { customPackages, total, totalPages, isLoading, updateStatus, isUpdating } = useAdminCustomPackages(page);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const handleStatusUpdate = (pkgId: string, newStatus: string) => {
    updateStatus({
      id: pkgId,
      data: {
        status: newStatus,
        admin_notes: adminNotes,
        estimated_price: estimatedPrice || undefined,
      },
    });
    setIsDetailsOpen(false);
  };

  const openDetails = (pkg: any) => {
    setSelectedPackage(pkg);
    setAdminNotes(pkg.admin_notes || '');
    setEstimatedPrice(pkg.estimated_price || 0);
    setIsDetailsOpen(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BuildPackageIcon className="w-5 h-5 text-muted-foreground" />
          Custom Packages ({total})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Package ID</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Destination</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Budget</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Travel Date</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customPackages.map((pkg) => (
                    <tr key={pkg.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{pkg.user?.full_name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground truncate">{pkg.user?.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground font-mono hidden lg:table-cell">{pkg.package_code || '—'}</td>
                      <td className="py-3 px-3 text-sm text-muted-foreground hidden sm:table-cell">{pkg.title || 'N/A'}</td>
                      <td className="py-3 px-3 text-sm font-medium text-foreground hidden md:table-cell">
                        {pkg.budget ? formatCurrency(pkg.budget) : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground hidden lg:table-cell">
                        {pkg.travel_date ? formatDate(pkg.travel_date) : 'N/A'}
                      </td>
                      <td className="py-3 px-3">
                        <Badge className={cn('text-xs', getStatusColor(pkg.status))}>
                          {pkg.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetails(pkg)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

        {/* Details Modal */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Custom Package Details</DialogTitle>
            </DialogHeader>
            {selectedPackage && (
              <div className="space-y-4">
                {selectedPackage.package_code && (
                  <div className="bg-accent p-3 rounded-lg">
                    <Label className="text-muted-foreground">Package ID</Label>
                    <p className="font-mono font-medium text-lg">{selectedPackage.package_code}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">User</Label>
                    <p className="font-medium">{selectedPackage.user?.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedPackage.user?.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Budget</Label>
                    <p className="font-medium">{selectedPackage.budget ? formatCurrency(selectedPackage.budget) : 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Travel Date</Label>
                    <p className="font-medium">{selectedPackage.travel_date ? formatDate(selectedPackage.travel_date) : 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Travelers</Label>
                    <p className="font-medium">{selectedPackage.num_travelers}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Accommodation</Label>
                    <p className="font-medium capitalize">{selectedPackage.accommodation_type || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Transport</Label>
                    <p className="font-medium capitalize">{selectedPackage.transport_type || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Destination</Label>
                    <p className="font-medium">{selectedPackage.title || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Return Date</Label>
                    <p className="font-medium">
                      {selectedPackage.return_date ? formatDate(selectedPackage.return_date) : '—'}
                    </p>
                  </div>
                </div>
                {/* What the traveller picked in the builder, so the quote can be
                    priced against the actual districts / spots / activities. */}
                {selectedPackage.division && (
                  <div>
                    <Label className="text-muted-foreground">Division</Label>
                    <p className="font-medium">{selectedPackage.division}</p>
                  </div>
                )}
                {selectedPackage.districts?.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Districts</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedPackage.districts.map((district: string) => (
                        <span
                          key={district}
                          className="inline-block rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium"
                        >
                          {district}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedPackage.tour_spots?.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Tour Spots</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedPackage.tour_spots.map((spot: string) => (
                        <span
                          key={spot}
                          className="inline-block rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium"
                        >
                          {spot}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedPackage.activities?.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Activities</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedPackage.activities.map((activity: string) => (
                        <span
                          key={activity}
                          className="inline-block rounded-full bg-muted text-foreground text-xs px-2.5 py-1 font-medium"
                        >
                          {activity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedPackage.special_requests && (
                  <div>
                    <Label className="text-muted-foreground">Special Requests</Label>
                    <p className="font-medium">{selectedPackage.special_requests}</p>
                  </div>
                )}
                <div className="border-t pt-4">
                  <Label>Estimated Price (৳)</Label>
                  <Input
                    type="number"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Admin Notes</Label>
                  <Input
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes..."
                    className="mt-1"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleStatusUpdate(selectedPackage?.id, 'rejected')}
                disabled={isUpdating}
              >
                Reject
              </Button>
              <Button
                onClick={() => handleStatusUpdate(selectedPackage?.id, 'approved')}
                disabled={isUpdating}
              >
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
