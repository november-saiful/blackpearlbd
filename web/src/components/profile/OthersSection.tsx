import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { humanizeDashes } from '@/lib/text';
import type { Booking } from '@/types';

interface OthersSectionProps {
  bookings: Booking[];
}

export function OthersSection({ bookings }: OthersSectionProps) {
  if (bookings.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No pending, processing, or rejected bookings
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => {
        const destination = humanizeDashes(booking.deal?.destination || 'Custom Package');
        const title = humanizeDashes(booking.deal?.title || booking.custom_package?.title || 'Trip');
        const type = booking.booking_type === 'deal' ? 'Deal' : 'Custom';
        const date = booking.custom_package?.travel_date || booking.booked_at;

        return (
          <Card key={booking.id}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{type}</Badge>
                    <span className="text-sm text-muted-foreground">{destination}</span>
                  </div>
                  <h4 className="font-semibold text-primary">{title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(date)} • {formatCurrency(booking.total_amount)}
                  </p>
                </div>
                
                <Badge className={getStatusColor(booking.status)}>
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
