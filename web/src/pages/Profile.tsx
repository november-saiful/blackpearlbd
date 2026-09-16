import { useProfile } from '@/hooks/useProfile';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { StatsCards } from '@/components/profile/StatsCards';
import { ToursSection } from '@/components/profile/ToursSection';
import { OthersSection } from '@/components/profile/OthersSection';
import { SavedDealsSection } from '@/components/profile/SavedDealsSection';
import { ProfilePageSkeleton } from '@/components/skeletons/ProfilePageSkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfilePage() {
  const { profile, stats, tours, pendingBookings, isLoading } = useProfile();

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
