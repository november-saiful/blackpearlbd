import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CascadingSelect } from './CascadingSelect';
import { BudgetInput } from './BudgetInput';
import { PackageSummary } from './PackageSummary';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PackageBuilderSchema, type PackageBuilderValues } from '@/lib/validators';
import toast from 'react-hot-toast';
import { Loader2 } from '@/components/ui/icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/base/date-picker/date-picker';
import { getLocalTimeZone, today, parseDate } from '@internationalized/date';
import type { DateValue } from 'react-aria-components';

export function PackageBuilderForm() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const form = useForm<PackageBuilderValues>({
    resolver: zodResolver(PackageBuilderSchema),
    defaultValues: {
      destinationId: '',
      travelDate: '',
      numTravelers: 1,
      accommodationType: undefined,
      transportType: undefined,
      budget: 0,
      activities: [],
      specialRequests: '',
    },
  });

  const { watch, control, formState: { isSubmitting } } = form;
  const formValues = watch();

  const onSubmit = async (data: PackageBuilderValues) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to create a package');
      return;
    }

    try {
      await api.createCustomPackage({
        destination_id: data.destinationId,
        budget: data.budget,
        travel_date: new Date(data.travelDate).toISOString(),
        num_travelers: data.numTravelers,
        accommodation_type: data.accommodationType,
        transport_type: data.transportType,
        activities: data.activities,
        special_requests: data.specialRequests,
      });

      toast.success('Package created successfully!');
      navigate('/profile');
    } catch (error) {
      toast.error('Failed to create package');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Destination */}
          <Card>
            <CardHeader>
              <CardTitle>1. Select Destination</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={control}
                name="destinationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <FormControl>
                      <CascadingSelect
                        value={field.value || null}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Step 2: Travel Details */}
          <Card>
            <CardHeader>
              <CardTitle>2. Travel Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={control}
                name="travelDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Travel Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        aria-label="Travel date"
                        value={field.value ? parseDate(field.value) : null}
                        minValue={today(getLocalTimeZone())}
                        onChange={(date: DateValue | null) =>
                          field.onChange(date ? date.toString() : '')
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="numTravelers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Travelers</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={50}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="accommodationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accommodation Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select accommodation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="budget">Budget</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="luxury">Luxury</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="transportType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transport Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select transport" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="flight">Flight</SelectItem>
                        <SelectItem value="bus">Bus</SelectItem>
                        <SelectItem value="train">Train</SelectItem>
                        <SelectItem value="self">Self</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Step 3: Budget */}
          <Card>
            <CardHeader>
              <CardTitle>3. Your Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget (৳)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">৳</span>
                        <Input
                          {...field}
                          type="number"
                          placeholder="Enter your budget"
                          className="pl-8"
                          min={0}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Step 4: Special Requests */}
          <Card>
            <CardHeader>
              <CardTitle>4. Special Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={control}
                name="specialRequests"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Any special requirements or requests..."
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Package...
              </>
            ) : (
              'Create Package'
            )}
          </Button>
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <PackageSummary
              destination={formValues.destinationId || null}
              travelDate={formValues.travelDate}
              numTravelers={formValues.numTravelers}
              accommodationType={formValues.accommodationType || ''}
              transportType={formValues.transportType || ''}
              budget={formValues.budget}
              activities={formValues.activities}
              specialRequests={formValues.specialRequests || ''}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
