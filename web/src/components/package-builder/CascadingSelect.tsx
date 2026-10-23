import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { Destination } from '@/types';

interface CascadingSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function CascadingSelect({ value, onChange }: CascadingSelectProps) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        const data = await api.getDestinations();
        setDestinations(data.destinations);
      } catch (error) {
        console.error('Failed to fetch destinations:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDestinations();
  }, []);

  const countries = destinations.filter((d) => d.type === 'country');
  const cities = countries.find((c) => c.id === selectedCountry)?.children || [];
  const activities = cities.find((c) => c.id === selectedCity)?.children || [];

  const handleCountryChange = (countryId: string) => {
    setSelectedCountry(countryId);
    setSelectedCity(null);
    onChange(null);
  };

  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    onChange(cityId);
  };

  const handleActivityChange = (activityId: string) => {
    onChange(activityId);
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading destinations">
        {[0, 1].map((index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Country</Label>
        <Select value={selectedCountry || ''} onValueChange={handleCountryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.id} value={country.id}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCountry && (
        <div>
          <Label>City</Label>
          <Select value={selectedCity || ''} onValueChange={handleCityChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedCity && activities.length > 0 && (
        <div>
          <Label>Activity</Label>
          <Select value={value || ''} onValueChange={handleActivityChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select activity (optional)" />
            </SelectTrigger>
            <SelectContent>
              {activities.map((activity) => (
                <SelectItem key={activity.id} value={activity.id}>
                  {activity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
