import { describe, expect, it } from 'vitest';
import {
  buildCustomPackagePayload,
  buildPackageTitle,
  isPreferencesComplete,
  toIsoDate,
  type PackageDraft,
} from './package-builder';

function draft(overrides: Partial<PackageDraft> = {}): PackageDraft {
  return {
    destinationValue: 'thailand',
    destinationLabel: 'Thailand',
    fromDate: '2026-11-02',
    toDate: '2026-11-08',
    division: '',
    districts: [],
    tourSpots: [],
    numTravelers: 2,
    accommodationType: 'standard',
    transportType: 'flight',
    budget: 85000,
    activities: ['Sightseeing'],
    specialRequests: '',
    ...overrides,
  };
}

describe('toIsoDate', () => {
  it('pads single-digit picker parts', () => {
    expect(toIsoDate({ year: '2026', month: '3', day: '9' })).toBe('2026-03-09');
  });

  it('leaves already padded parts alone', () => {
    expect(toIsoDate({ year: '2026', month: '12', day: '31' })).toBe('2026-12-31');
  });
});

describe('buildPackageTitle', () => {
  it('uses the destination label on its own', () => {
    expect(buildPackageTitle(draft())).toBe('Thailand');
  });

  it('appends the division and districts for Bangladeshi custom tours', () => {
    expect(
      buildPackageTitle(
        draft({
          destinationLabel: 'Bangladesh (Customized)',
          division: 'Dhaka',
          districts: ['Dhaka', 'Gazipur'],
        }),
      ),
    ).toBe('Bangladesh (Customized) · Dhaka (Dhaka, Gazipur)');
  });

  it('falls back when the destination list changed under the traveller', () => {
    expect(buildPackageTitle(draft({ destinationLabel: '' }))).toBe('Custom package');
  });

  it('never exceeds the column limit, even with every district picked', () => {
    const title = buildPackageTitle(
      draft({ destinationLabel: 'Bangladesh (Customized)', districts: Array(60).fill('Chattogram') }),
    );
    expect(title.length).toBe(200);
  });
});

describe('isPreferencesComplete', () => {
  it('accepts a filled-in step 2', () => {
    expect(isPreferencesComplete(draft())).toBe(true);
  });

  it.each([
    ['no accommodation', { accommodationType: '' }],
    ['no transport', { transportType: '' }],
    ['no budget', { budget: 0 }],
    ['fractional travelers', { numTravelers: 1.5 }],
    ['no travelers', { numTravelers: 0 }],
    ['too many travelers', { numTravelers: 51 }],
  ])('rejects %s', (_label, overrides) => {
    expect(isPreferencesComplete(draft(overrides))).toBe(false);
  });
});

describe('buildCustomPackagePayload', () => {
  it('sends the slug, both dates and every preference', () => {
    expect(buildCustomPackagePayload(draft())).toEqual({
      title: 'Thailand',
      destination_value: 'thailand',
      budget: 85000,
      travel_date: '2026-11-02',
      return_date: '2026-11-08',
      num_travelers: 2,
      accommodation_type: 'standard',
      transport_type: 'flight',
      activities: ['Sightseeing'],
      division: undefined,
      districts: [],
      tour_spots: [],
      special_requests: undefined,
    });
  });

  it('omits a return date for a single-day request', () => {
    const payload = buildCustomPackagePayload(draft({ toDate: '2026-11-02' }));
    expect(payload.return_date).toBeUndefined();
  });

  it('omits blank optional fields instead of sending empty strings', () => {
    const payload = buildCustomPackagePayload(draft({ specialRequests: '   ' }));
    expect(payload.special_requests).toBeUndefined();
    expect('destination_id' in payload).toBe(false);
  });

  it('trims special requests and caps them at the schema limit', () => {
    expect(buildCustomPackagePayload(draft({ specialRequests: '  late check-in  ' })).special_requests).toBe(
      'late check-in',
    );
    expect(
      buildCustomPackagePayload(draft({ specialRequests: 'x'.repeat(2500) })).special_requests,
    ).toHaveLength(2000);
  });

  it('carries the Bangladeshi tour spots through', () => {
    const payload = buildCustomPackagePayload(
      draft({
        destinationValue: 'dhaka-division',
        destinationLabel: 'Dhaka Division',
        districts: ['Dhaka'],
        tourSpots: ['Ahsan Manzil'],
      }),
    );
    expect(payload.districts).toEqual(['Dhaka']);
    expect(payload.tour_spots).toEqual(['Ahsan Manzil']);
  });
});
