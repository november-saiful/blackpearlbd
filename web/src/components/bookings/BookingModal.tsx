import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBookings } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { humanizeDealText } from '@/lib/text';
import { Loader2, User } from 'lucide-react';
import type { TourDeal } from '@/types';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: TourDeal;
}

export function BookingModal({ isOpen, onClose, deal: rawDeal }: BookingModalProps) {
  const deal = humanizeDealText(rawDeal);
  const { isAuthenticated, profile } = useAuth();
  const { createBooking, isCreating } = useBookings();
  const [travelerDetails, setTravelerDetails] = useState({
    name: '',
    email: '',
    phone: '',
    emergency_contact: '',
  });

  // Auto-fill from profile when modal opens for signed-in users
  useEffect(() => {
    if (isOpen && isAuthenticated && profile) {
      setTravelerDetails({
        name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        emergency_contact: '',
      });
    } else if (isOpen) {
      // Reset form for non-signed-in users
      setTravelerDetails({
        name: '',
        email: '',
        phone: '',
        emergency_contact: '',
      });
    }
  }, [isOpen, isAuthenticated, profile]);

  const handleConfirm = () => {
    if (!travelerDetails.name || !travelerDetails.email || !travelerDetails.phone) {
      return;
    }

    createBooking({
      booking_type: 'deal',
      deal_id: deal.id,
      total_amount: deal.price,
      traveler_details: travelerDetails,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Confirm Booking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Deal Summary */}
          <div className="glass-chip p-4 rounded-xl">
            <h4 className="font-semibold text-primary">{deal.title}</h4>
            <p className="text-sm text-muted-foreground">{deal.destination}</p>
            <p className="text-lg font-bold text-primary mt-2">
              {formatCurrency(deal.price)}
            </p>
          </div>

          {/* Guest Notice */}
          {!isAuthenticated && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                You're booking as a guest.{' '}
                <strong>Sign in</strong> next time to skip this step and track your bookings.
              </p>
            </div>
          )}

          {/* Traveler Details Form */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={travelerDetails.name}
                onChange={(e) =>
                  setTravelerDetails({ ...travelerDetails, name: e.target.value })
                }
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={travelerDetails.email}
                onChange={(e) =>
                  setTravelerDetails({ ...travelerDetails, email: e.target.value })
                }
                placeholder="Enter your email"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={travelerDetails.phone}
                onChange={(e) =>
                  setTravelerDetails({ ...travelerDetails, phone: e.target.value })
                }
                placeholder="Enter your phone number"
              />
            </div>
            <div>
              <Label htmlFor="emergency">Emergency Contact</Label>
              <Input
                id="emergency"
                value={travelerDetails.emergency_contact}
                onChange={(e) =>
                  setTravelerDetails({
                    ...travelerDetails,
                    emergency_contact: e.target.value,
                  })
                }
                placeholder="Emergency contact (optional)"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isCreating || !travelerDetails.name || !travelerDetails.email || !travelerDetails.phone}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Booking'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
