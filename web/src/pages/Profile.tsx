import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { StatsCards } from '@/components/profile/StatsCards';
import { ToursSection } from '@/components/profile/ToursSection';
import { PackagesSection } from '@/components/profile/PackagesSection';
import { OthersSection } from '@/components/profile/OthersSection';
import { SavedDealsSection } from '@/components/profile/SavedDealsSection';
import { ProfilePageSkeleton } from '@/components/skeletons/ProfilePageSkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Parallelise the profile reads so no single query blocks the next: the
// profile record, its stats, tours, pending bookings, pearls history and the
// custom package requests are all independent and all hit the Worker's edge
// cache after the first request.
export default function ProfilePage() {
  const queries = useQueries({
    queries: [
      { queryKey: ['profile'], queryFn: () => api.getProfile(), staleTime: 5 * 60 * 1000 },
      { queryKey: ['profile-stats'], queryFn: () => api.getProfileStats(), staleTime: 5 * 60 * 1000 },
      { queryKey: ['profile-tours'], queryFn: () => api.getProfileTours(), staleTime: 5 * 60 * 1000 },
      { queryKey: ['profile-pending'], queryFn: () => api.getProfilePending(), staleTime: 5 * 60 * 1000 },
      { queryKey: ['profile-pearls'], queryFn: () => api.getProfilePearls(), staleTime: 5 * 60 * 1000 },
      { queryKey: ['custom-packages'], queryFn: () => api.getCustomPackages(), staleTime: 5 * 60 * 1000 },
    ] as const,
  });
  const profile = queries[0].data?.profile;
  const stats = queries[1].data;
  const tours = queries[2].data?.tours || [];
  const pendingBookings = queries[3].data?.bookings || [];
  const pearlsHistory = queries[4].data?.history || [];
  const customPackages = queries[5].data?.customPackages || [];
  const isLoading = queries.some((q) => q.isLoading);

  if (isLoading) {
    return <ProfilePageSkeleton />;
  }

  if (!profile || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="site-container py-12 space-y-8">
      {/* Profile Card */}
      <ProfileCard profile={profile} />

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Package Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            My Packages
            <span className="text-sm font-normal text-muted-foreground">(Custom requests)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PackagesSection />
        </CardContent>
      </Card>

      {/* Tours Section */}
      <Card>
        <CardHeader>
          <CardTitle>My Tours</CardTitle>
        </CardHeader>
        <CardContent>
          <ToursSection tours={tours} />
        </CardContent>
      </Card>

      {/* Others Section */}
      <Card>
        <CardHeader>
          <CardTitle>Others</CardTitle>
        </CardHeader>
        <CardContent>
          <OthersSection bookings={pendingBookings} />
        </CardContent>
      </Card>

      {/* Saved Deals Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Saved Deals
            <span className="text-sm font-normal text-muted-foreground">(Bookmarks)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SavedDealsSection />
        </CardContent>
      </Card>
    </div>
  );
}
