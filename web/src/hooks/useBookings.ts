import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { generateInvoicePDF } from '../lib/pdf-generator';
import toast from 'react-hot-toast';

export function useBookings() {
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.getBookings(),
  });

  const createBookingMutation = useMutation({
    mutationFn: (data: {
      booking_type: string;
      deal_id?: string;
      custom_package_id?: string;
      total_amount: number;
      traveler_details: Record<string, unknown>;
    }) => api.createBooking(data as any),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      // Deal-only invoice layout: skip PDF for non-deal bookings.
      if (data.booking?.booking_type === 'deal' && data.booking?.deal) {
        try {
          await generateInvoicePDF(data.booking);
          toast.success('Booking request submitted! Invoice downloaded.');
        } catch {
          toast.success('Booking request submitted!');
        }
      } else {
        toast.success('Booking request submitted!');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create booking');
    },
  });

  return {
    bookings: bookingsQuery.data?.bookings || [],
    isLoading: bookingsQuery.isLoading,
    createBooking: createBookingMutation.mutate,
    isCreating: createBookingMutation.isPending,
  };
}

export function useInvoice(bookingId: string) {
  const invoiceQuery = useQuery({
    queryKey: ['invoice', bookingId],
    queryFn: () => api.getInvoice(bookingId),
    enabled: !!bookingId,
  });

  const downloadInvoice = async () => {
    const invoice = invoiceQuery.data?.invoice;
    if (!invoice) return;
    // Invoice layout covers deal bookings only.
    if (invoice.booking_type !== 'deal' || !invoice.deal) {
      toast.error('Invoices are available for deal bookings only.');
      return;
    }
    try {
      await generateInvoicePDF(invoice);
      toast.success('Invoice downloaded');
    } catch {
      toast.error('Failed to generate invoice');
    }
  };

  return {
    invoice: invoiceQuery.data?.invoice,
    isLoading: invoiceQuery.isLoading,
    downloadInvoice,
  };
}
