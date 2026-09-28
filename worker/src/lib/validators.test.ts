import { describe, expect, it } from 'vitest';
import { CreateCustomPackageSchema } from './validators';

const builderPayload = {
  title: 'Thailand',
  destination_value: 'thailand',
  budget: 85000,
  travel_date: '2026-11-02',
  return_date: '2026-11-08',
  num_travelers: 2,
  accommodation_type: 'standard',
  transport_type: 'flight',
  activities: ['Sightseeing'],
  special_requests: '',
};

describe('CreateCustomPackageSchema', () => {
  it('accepts what the 3-step builder sends', () => {
    const result = CreateCustomPackageSchema.safeParse(builderPayload);

    expect(result.success).toBe(true);
    expect(result.success && result.data.destination_value).toBe('thailand');
    expect(result.success && result.data.return_date).toBe('2026-11-08');
    // The route inserts `...result.data`, so anything stripped here never
    // reaches the database.
    expect(result.success && result.data.activities).toEqual(['Sightseeing']);
  });

  it('keeps the Bangladeshi division / districts / tour spots', () => {
    const result = CreateCustomPackageSchema.safeParse({
      ...builderPayload,
      destination_value: 'dhaka-division',
      division: 'Dhaka',
      districts: ['Dhaka', 'Gazipur'],
      tour_spots: ['Ahsan Manzil'],
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.division).toBe('Dhaka');
    expect(result.success && result.data.districts).toEqual(['Dhaka', 'Gazipur']);
    expect(result.success && result.data.tour_spots).toEqual(['Ahsan Manzil']);
  });

  it('still accepts a geo destination id from older clients', () => {
    const { destination_value: _slug, ...rest } = builderPayload;
    const result = CreateCustomPackageSchema.safeParse({
      ...rest,
      destination_id: '3f5c1f4e-9b3a-4c3b-9c2e-2f1c9f4e8a11',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a package that does not say where the traveller is going', () => {
    const { destination_value: _slug, ...rest } = builderPayload;
    const result = CreateCustomPackageSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it('treats an empty destination slug as missing', () => {
    const result = CreateCustomPackageSchema.safeParse({
      ...builderPayload,
      destination_value: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a destination that is not a slug', () => {
    const result = CreateCustomPackageSchema.safeParse({
      ...builderPayload,
      destination_value: 'Thailand',
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ['accommodation outside the enum', { accommodation_type: 'hostel' }],
    ['transport outside the enum', { transport_type: 'ferry' }],
    ['a zero budget', { budget: 0 }],
    ['a negative budget', { budget: -100 }],
    ['zero travelers', { num_travelers: 0 }],
    ['more travelers than the cap', { num_travelers: 51 }],
    ['a missing travel date', { travel_date: undefined }],
  ])('rejects %s', (_label, overrides) => {
    expect(CreateCustomPackageSchema.safeParse({ ...builderPayload, ...overrides }).success).toBe(
      false,
    );
  });
});
