import { BookingsManager } from '@/components/admin/BookingsManager';
import { AdminNav } from '@/components/admin/AdminNav';
import { Calendar } from '@/components/ui/icons';

export default function AdminBookings() {
  return (
    <div className="px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
            <p className="text-sm text-muted-foreground">Manage customer bookings</p>
          </div>
        </div>
        <AdminNav />
      </div>
      <BookingsManager />
    </div>
  );
}
