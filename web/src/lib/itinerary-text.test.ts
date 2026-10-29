import { describe, expect, it } from 'vitest';
import { parseItineraryDescription } from './itinerary-text';

describe('parseItineraryDescription', () => {
  it('keeps a plain description as one paragraph', () => {
    expect(parseItineraryDescription('Pickup from the hotel at 8am.')).toEqual([
      { kind: 'text', lines: ['Pickup from the hotel at 8am.'] },
    ]);
  });

  it('groups consecutive bullet lines into one list', () => {
    expect(parseItineraryDescription('Breakfast at the hotel\n- Jeep to Nilgiri\n- Lunch on the hill')).toEqual([
      { kind: 'text', lines: ['Breakfast at the hotel'] },
      { kind: 'bullets', items: ['Jeep to Nilgiri', 'Lunch on the hill'] },
    ]);
  });

  it('accepts every marker the editor offers', () => {
    expect(parseItineraryDescription('- one\n* two\n• three')).toEqual([
      { kind: 'bullets', items: ['one', 'two', 'three'] },
    ]);
  });

  it('splits a list on a blank line and drops the blank', () => {
    expect(parseItineraryDescription('- one\n\n- two')).toEqual([
      { kind: 'bullets', items: ['one'] },
      { kind: 'bullets', items: ['two'] },
    ]);
  });

  it('keeps blank lines inside a paragraph so the author spacing survives', () => {
    expect(parseItineraryDescription('First\n\nSecond')).toEqual([
      { kind: 'text', lines: ['First', '', 'Second'] },
    ]);
  });

  it('ignores an empty bullet left mid-typing', () => {
    expect(parseItineraryDescription('- ')).toEqual([]);
    expect(parseItineraryDescription('- kept\n- ')).toEqual([
      { kind: 'bullets', items: ['kept'] },
    ]);
  });

  it('treats a dash without a space as prose, not a bullet', () => {
    expect(parseItineraryDescription('-5 degrees at night')).toEqual([
      { kind: 'text', lines: ['-5 degrees at night'] },
    ]);
  });

  it('returns nothing for an empty description', () => {
    expect(parseItineraryDescription('')).toEqual([]);
    expect(parseItineraryDescription(null)).toEqual([]);
    expect(parseItineraryDescription('   \n  ')).toEqual([]);
  });
});
