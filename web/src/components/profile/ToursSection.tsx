import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, MapPin, Calendar } from '@/components/ui/icons';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { formatDuration } from '@/lib/duration';
import { humanizeDashes } from '@/lib/text';
import { useLocalizedDeal } from '@/lib/deal-locale';
import { useInvoice } from '@/hooks/useBookings';
import type { Booking } from '@/types';

interface ToursSectionProps {
  tours: Booking[];
}

function TourCard({ booking }: { booking: Booking }) {
  const { downloadInvoice } = useInvoice(booking.id);
  const deal = useLocalizedDeal(booking.deal) ?? booking.deal;

  const destination = humanizeDashes(deal?.destination || 'Custom Package');
  const title = humanizeDashes(deal?.title || booking.custom_package?.title || 'Trip');
  const date = deal
    ? formatDuration(deal.duration_days)
    : booking.custom_package?.travel_date || 'N/A';

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
              <span>{date}</span>
              <span className="text-primary-foreground/70">•</span>
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

export function ToursSection({ tours }: ToursSectionProps) {
  const today = new Date();
  
  const upcomingTours = tours.filter((t) => {
    const travelDate = t.custom_package?.travel_date;
    return travelDate && new Date(travelDate) > today;
  });

  const pastTours = tours.filter((t) => {
    const travelDate = t.custom_package?.travel_date;
    return travelDate && new Date(travelDate) < today;
  });

  // Tours without specific dates (deals) go to current
  const currentTours = tours.filter((t) => {
    if (t.booking_type === 'deal') return true;
    const travelDate = t.custom_package?.travel_date;
    if (!travelDate) return true;
    return new Date(travelDate) <= today;
  });

  return (
    <Tabs defaultValue="upcoming" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="upcoming">Upcoming ({upcomingTours.length})</TabsTrigger>
        <TabsTrigger value="current">Current ({currentTours.length})</TabsTrigger>
        <TabsTrigger value="past">Past ({pastTours.length})</TabsTrigger>
      </TabsList>
      
      <TabsContent value="upcoming" className="mt-4">
        {upcomingTours.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No upcoming tours</p>
        ) : (
          upcomingTours.map((tour) => <TourCard key={tour.id} booking={tour} />)
        )}
      </TabsContent>
      
      <TabsContent value="current" className="mt-4">
        {currentTours.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No current tours</p>
        ) : (
          currentTours.map((tour) => <TourCard key={tour.id} booking={tour} />)
        )}
      </TabsContent>
      
      <TabsContent value="past" className="mt-4">
        {pastTours.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No past tours</p>
        ) : (
          pastTours.map((tour) => <TourCard key={tour.id} booking={tour} />)
        )}
      </TabsContent>
    </Tabs>
  );
}
