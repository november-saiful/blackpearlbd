import { describe, expect, it } from 'vitest';
import type { PackageDestination } from '@/types';
import {
  buildDestinationOptions,
  destinationOptionMatches,
  groupDestinationOptions,
  UNLISTED_DESTINATION_GROUP,
} from './deals-destination';

/** One destination row, so no test has to spell out the whole table. */
function row(overrides: Partial<PackageDestination> = {}): PackageDestination {
  return {
    id: 'dest-1',
    category: 'Bangladesh',
    name: 'Dhaka Division',
    value: 'dhaka-division',
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildDestinationOptions', () => {
  it('orders categories by name and rows by sort_order then name', () => {
    const options = buildDestinationOptions(
      [
        row({ id: 'a', category: 'Europe', name: 'France', sort_order: 1 }),
        row({ id: 'b', category: 'Europe', name: 'Switzerland', sort_order: 0 }),
        row({ id: 'c', category: 'Asia', name: 'Thailand', sort_order: 0 }),
        row({ id: 'd', category: 'Bangladesh', name: 'Sylhet Division', sort_order: 1 }),
        row({ id: 'e', category: 'Bangladesh', name: 'Dhaka Division', sort_order: 0 }),
      ],
      '',
    );

    expect(options.map((option) => option.name)).toEqual([
      'Thailand',
      'Dhaka Division',
      'Sylhet Division',
      'Switzerland',
      'France',
    ]);
  });

  it('leaves retired destinations out of the menu', () => {
    const options = buildDestinationOptions(
      [
        row({ id: 'a', name: 'Thailand', category: 'Asia' }),
        row({ id: 'b', name: 'France', category: 'Europe', is_active: false }),
      ],
      '',
    );

    expect(options.map((option) => option.name)).toEqual(['Thailand']);
  });

  it('offers one choice per name, since the name is the stored value', () => {
    const options = buildDestinationOptions(
      [
        row({ id: 'a', name: 'Maldives', category: 'Asia', sort_order: 1 }),
        row({ id: 'b', name: 'Maldives', category: 'Islands', sort_order: 0 }),
      ],
      '',
    );

    // The first row in the menu's own order wins, so the choice keeps the
    // heading a reader would look under.
    expect(options).toHaveLength(1);
    expect(options[0]).toEqual({ name: 'Maldives', category: 'Asia' });
  });

  it('keeps a deal whose destination is not on the list, on top and labelled', () => {
    const options = buildDestinationOptions(
      [row({ id: 'a', name: 'Thailand', category: 'Asia' })],
      'Sundarban',
    );

    expect(options[0]).toEqual({ name: 'Sundarban', category: UNLISTED_DESTINATION_GROUP });
    expect(options).toHaveLength(2);
  });

  it('does not duplicate a destination that is both stored and listed', () => {
    const options = buildDestinationOptions(
      [row({ id: 'a', name: 'Thailand', category: 'Asia' })],
      'Thailand',
    );

    expect(options).toEqual([{ name: 'Thailand', category: 'Asia' }]);
  });

  it('keeps a destination that has since been retired, so edits survive', () => {
    const options = buildDestinationOptions(
      [row({ id: 'a', name: 'France', category: 'Europe', is_active: false })],
      'France',
    );

    expect(options).toEqual([{ name: 'France', category: UNLISTED_DESTINATION_GROUP }]);
  });

  it('is empty when the admin has no destinations and the deal has no value', () => {
    expect(buildDestinationOptions([], '')).toEqual([]);
  });
});

describe('destinationOptionMatches', () => {
  const option = { name: 'Cox’s Bazar', category: 'Chattogram Division' };

  it('matches anything while the search box is empty', () => {
    expect(destinationOptionMatches(option, '')).toBe(true);
    expect(destinationOptionMatches(option, '   ')).toBe(true);
  });

  it('matches on the name and on the heading', () => {
    expect(destinationOptionMatches(option, 'cox')).toBe(true);
    expect(destinationOptionMatches(option, 'chattogram')).toBe(true);
    expect(destinationOptionMatches(option, 'bazar')).toBe(true);
  });

  it('is case-insensitive and ignores surrounding spaces', () => {
    expect(destinationOptionMatches(option, '  COX  ')).toBe(true);
  });

  it('rejects what it does not contain', () => {
    expect(destinationOptionMatches(option, 'paris')).toBe(false);
  });
});

describe('groupDestinationOptions', () => {
  const options = [
    { name: 'Dhaka Division', category: 'Bangladesh' },
    { name: 'Sylhet Division', category: 'Bangladesh' },
    { name: 'Thailand', category: 'Asia' },
  ];

  it('groups under the heading the options came in with', () => {
    const groups = groupDestinationOptions(options, '');

    expect(groups.map((group) => group.category)).toEqual(['Bangladesh', 'Asia']);
    expect(groups[0].items).toHaveLength(2);
  });

  it('drops a heading once none of its rows match, so no empty group renders', () => {
    const groups = groupDestinationOptions(options, 'thai');

    expect(groups).toEqual([{ category: 'Asia', items: [{ name: 'Thailand', category: 'Asia' }] }]);
  });

  it('returns nothing when the search matches no destination at all', () => {
    expect(groupDestinationOptions(options, 'atlantis')).toEqual([]);
  });
});
