import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarRange, Loader2, MapPin, Users } from 'lucide-react';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCustomPackages } from '@/hooks/useProfile';
import type { CustomPackage } from '@/types';

/** Chip row for the structured choices the builder stored with a package. */
function Chips({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {values.map((value) => (
        <span
          key={value}
          className="inline-block rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function dateRangeLabel(pkg: CustomPackage) {
  if (!pkg.travel_date) return 'Dates to confirm';
  const from = formatDate(pkg.travel_date);
  if (!pkg.return_date || pkg.return_date === pkg.travel_date) return from;
  return `${from} → ${formatDate(pkg.return_date)}`;
}

/**
 * The traveller's package requests, with the admin's quote once it is issued.
 *
 * A request only becomes bookable once an admin approves it and sets an
 * estimated price — booking then creates the booking row that shows up under
 * My Tours, so this section is what closes the build → quote → book loop.
 */
export function PackagesSection() {
  const { packages, isLoading, bookPackage, isBooking } = useCustomPackages();
  const { profile } = useAuth();
  const [bookingTarget, setBookingTarget] = useState<CustomPackage | null>(null);
  const [traveler, setTraveler] = useState({ name: '', email: '', phone: '' });

  const openBooking = (pkg: CustomPackage) => {
    setTraveler({
      name: profile?.full_name ?? '',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
    });
    setBookingTarget(pkg);
  };

  const travelerDetailsComplete =
    traveler.name.trim() !== '' && traveler.email.trim() !== '' && traveler.phone.trim() !== '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="py-6 text-center space-y-3">
        <p className="text-muted-foreground">You haven't requested a custom package yet.</p>
        <Button asChild variant="outline">
          <Link to="/build-package">Build a package</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      {packages.map((pkg) => (
        <Card key={pkg.id} className="mb-4 last:mb-0">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 text-secondary" />
                  <span className="truncate">{pkg.title || 'Custom package'}</span>
                  {pkg.package_code && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {pkg.package_code}
                    </span>
                  )}
                </div>
                <h4 className="font-semibold text-primary mt-1">{dateRangeLabel(pkg)}</h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {pkg.num_travelers} {pkg.num_travelers === 1 ? 'traveler' : 'travelers'}
                  </span>
                  {pkg.accommodation_type && (
                    <span className="capitalize">{pkg.accommodation_type}</span>
                  )}
                  {pkg.transport_type && <span className="capitalize">{pkg.transport_type}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 md:shrink-0">
                <Badge className={getStatusColor(pkg.status)}>{pkg.status}</Badge>
                {pkg.status === 'approved' && (
                  <Button size="sm" onClick={() => openBooking(pkg)}>
                    Book now
                  </Button>
                )}
              </div>
            </div>

            <Chips label="Division" values={pkg.division ? [pkg.division] : []} />
            <Chips label="Districts" values={pkg.districts ?? []} />
            <Chips label="Tour spots" values={pkg.tour_spots ?? []} />
            <Chips label="Activities" values={pkg.activities ?? []} />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t text-sm">
              <span className="text-muted-foreground">
                Budget:{' '}
                <span className="text-foreground font-medium">
                  {pkg.budget ? formatCurrency(pkg.budget) : '—'}
                </span>
              </span>
              {pkg.estimated_price ? (
                <span className="text-muted-foreground">
                  Our quote:{' '}
                  <span className="text-foreground font-semibold">
                    {formatCurrency(pkg.estimated_price)}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarRange className="w-3.5 h-3.5" />
                  We'll email a quote after reviewing your request.
                </span>
              )}
            </div>

            {pkg.special_requests && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                <span className="font-medium text-foreground">Your notes: </span>
                {pkg.special_requests}
              </p>
            )}

            {pkg.admin_notes && (
              <p className="text-sm rounded-lg bg-muted p-3 whitespace-pre-wrap">
                <span className="font-medium text-foreground">From our team: </span>
                {pkg.admin_notes}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!bookingTarget} onOpenChange={(open) => !open && setBookingTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm your traveler details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="traveler-name">Full name</Label>
              <Input
                id="traveler-name"
                value={traveler.name}
                onChange={(e) => setTraveler((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="traveler-email">Email</Label>
              <Input
                id="traveler-email"
                type="email"
                value={traveler.email}
                onChange={(e) => setTraveler((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="traveler-phone">Phone</Label>
              <Input
                id="traveler-phone"
                value={traveler.phone}
                onChange={(e) => setTraveler((prev) => ({ ...prev, phone: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!travelerDetailsComplete || isBooking}
              onClick={() => {
                if (!bookingTarget) return;
                bookPackage(
                  { id: bookingTarget.id, travelerDetails: { ...traveler } },
                  { onSuccess: () => setBookingTarget(null) },
                );
              }}
            >
              {isBooking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                'Confirm booking'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
