import { AdminStatsCards } from '@/components/admin/AdminStatsCards';
import { StorageWidget } from '@/components/admin/StorageWidget';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminStats } from '@/hooks/useAdmin';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { AdminDashboardSkeleton } from '@/components/skeletons/AdminDashboardSkeleton';
import { LayoutDashboard } from 'lucide-react';

export default function AdminDashboard() {
  const { stats, recentBookings, isLoading } = useAdminStats();

  if (isLoading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className="px-4 md:px-6 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of your platform</p>
          </div>
        </div>
        <AdminNav />
      </div>

      {/* Stats Cards */}
      {stats && <AdminStatsCards stats={stats} />}

      {/* Storage + Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Recent Bookings (2/3 width) */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {recentBookings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No recent bookings</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBookings.map((booking) => (
                        <tr key={booking.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-3">
                            <p className="text-sm font-medium text-foreground">{booking.user?.full_name || 'N/A'}</p>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className="text-xs">
                              {booking.booking_type === 'deal' ? 'Deal' : 'Custom'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-sm text-foreground">{formatCurrency(booking.total_amount)}</td>
                          <td className="py-3 px-3 text-sm text-muted-foreground">
                            {formatDate(booking.booked_at)}
                          </td>
                          <td className="py-3 px-3">
                            <Badge className={getStatusColor(booking.status)}>
                              {booking.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Storage Widget (1/3 width) */}
        <div className="lg:col-span-1">
          <StorageWidget />
        </div>
      </div>
    </div>
  );
}
