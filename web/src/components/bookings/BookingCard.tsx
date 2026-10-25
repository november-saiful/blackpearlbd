import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, MapPin, Calendar } from '@/components/ui/icons';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { humanizeDashes } from '@/lib/text';
import { useLocalizedDeal } from '@/lib/deal-locale';
import { useInvoice } from '@/hooks/useBookings';
import type { Booking } from '@/types';

interface BookingCardProps {
  booking: Booking;
}

export function BookingCard({ booking }: BookingCardProps) {
  const { downloadInvoice } = useInvoice(booking.id);
  const deal = useLocalizedDeal(booking.deal) ?? booking.deal;

  const destination = humanizeDashes(deal?.destination || 'Custom Package');
  const title = humanizeDashes(deal?.title || booking.custom_package?.title || 'Trip');

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-secondary" />
              <span className="text-sm text-muted-foreground">{destination}</span>
            </div>
            <h4 className="font-semibold text-primary">{title}</h4>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(booking.booked_at)}</span>
              <span className="text-slate-300">•</span>
              <span>{formatCurrency(booking.total_amount)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(booking.status)}>
              {booking.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={downloadInvoice}>
              <Download className="w-4 h-4 mr-1" />
              Invoice
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
