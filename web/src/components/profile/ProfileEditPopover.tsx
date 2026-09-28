import { Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useProfile } from '@/hooks/useProfile';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProfileEditSchema, type ProfileEditValues } from '@/lib/validators';
import type { Profile } from '@/types';
import { useState } from 'react';

interface ProfileEditPopoverProps {
  profile: Profile;
}

export function ProfileEditPopover({ profile }: ProfileEditPopoverProps) {
  const { updateProfile, isUpdating } = useProfile();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<ProfileEditValues>({
    resolver: zodResolver(ProfileEditSchema),
    defaultValues: {
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      address: profile.address || '',
    },
  });

  const onSubmit = (data: ProfileEditValues) => {
    updateProfile(data);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <h4 className="font-semibold text-primary">Edit Profile</h4>

            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="+880 1898766630" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Your address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </form>
        </Form>
      </PopoverContent>
    </Popover>
  );
}
