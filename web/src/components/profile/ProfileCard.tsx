import { User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfileEditPopover } from './ProfileEditPopover';
import type { Profile } from '@/types';

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center md:flex-row md:items-start gap-6">
          {/* Avatar */}
          <div className="relative">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'User'}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="glass-soft w-24 h-24 rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-primary mb-1">
              {profile.full_name || 'User'}
            </h2>
            <p className="text-muted-foreground mb-4">{profile.email}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{profile.phone || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Address:</span>
                <p className="font-medium">{profile.address || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {/* Edit Button */}
          <div className="md:self-start">
            <ProfileEditPopover profile={profile} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
