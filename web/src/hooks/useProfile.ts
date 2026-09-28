import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export function useProfile() {
  const queryClient = useQueryClient();
  const { setProfile } = useAuthStore();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { profile } = await api.getProfile();
      setProfile(profile);
      return profile;
    },
  });

  const statsQuery = useQuery({
    queryKey: ['profile-stats'],
    queryFn: () => api.getProfileStats(),
  });

  const toursQuery = useQuery({
    queryKey: ['profile-tours'],
    queryFn: () => api.getProfileTours(),
  });

  const pendingQuery = useQuery({
    queryKey: ['profile-pending'],
    queryFn: () => api.getProfilePending(),
  });

  const pearlsQuery = useQuery({
    queryKey: ['profile-pearls'],
    queryFn: () => api.getProfilePearls(),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { full_name?: string; phone?: string; address?: string }) =>
      api.updateProfile(data),
    onSuccess: (data) => {
      setProfile(data.profile);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  return {
    profile: profileQuery.data,
    stats: statsQuery.data,
    tours: toursQuery.data?.tours || [],
    pendingBookings: pendingQuery.data?.bookings || [],
    pearlsHistory: pearlsQuery.data?.history || [],
    isLoading: profileQuery.isLoading || statsQuery.isLoading,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
  };
}

/**
 * The traveller's own package requests, built in the 3-step builder.
 *
 * The builder invalidates `custom-packages` on submit and the admin queue
 * invalidates `admin-custom-packages`, so a fresh request and a newly issued
 * quote both appear without a page reload. Booking a package creates a booking
 * row, which is why the booking queries are invalidated too.
 */
export function useCustomPackages() {
  const queryClient = useQueryClient();

  const packagesQuery = useQuery({
    queryKey: ['custom-packages'],
    queryFn: () => api.getCustomPackages(),
  });

  const bookMutation = useMutation({
    mutationFn: ({
      id,
      travelerDetails,
    }: {
      id: string;
      travelerDetails: Record<string, unknown>;
    }) => api.bookCustomPackage(id, { traveler_details: travelerDetails }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-packages'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['profile-tours'] });
      queryClient.invalidateQueries({ queryKey: ['profile-pending'] });
      toast.success('Booking request submitted!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to book this package');
    },
  });

  return {
    packages: packagesQuery.data?.customPackages || [],
    isLoading: packagesQuery.isLoading,
    bookPackage: bookMutation.mutate,
    isBooking: bookMutation.isPending,
  };
}
