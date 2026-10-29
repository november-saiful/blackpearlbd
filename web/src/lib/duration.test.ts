import { describe, expect, it } from 'vitest';
import { formatDuration, formatDurationShort, tourNights } from './duration';

describe('tourNights', () => {
  it('counts the nights spent away, one fewer than the days', () => {
    expect(tourNights(3)).toBe(2);
    expect(tourNights(7)).toBe(6);
  });

  it('gives a day trip no nights, and never a negative count', () => {
    expect(tourNights(1)).toBe(0);
    expect(tourNights(0)).toBe(0);
  });

  it('treats a missing or unusable value as no nights', () => {
    expect(tourNights(null)).toBe(0);
    expect(tourNights(undefined)).toBe(0);
    expect(tourNights(Number.NaN)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('prints days and nights together', () => {
    expect(formatDuration(3)).toBe('3 Days / 2 Nights');
    expect(formatDuration(2)).toBe('2 Days / 1 Night');
  });

  it('leaves the nights out of a day trip', () => {
    expect(formatDuration(1)).toBe('1 Day');
  });

  it('prints nothing when the length is unknown', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(null)).toBe('');
  });

  it('writes the Bengali form with Bengali digits', () => {
    expect(formatDuration(3, 'bn')).toBe('৩ দিন / ২ রাত');
    expect(formatDuration(1, 'bn')).toBe('১ দিন');
  });
});

describe('formatDurationShort', () => {
  it('abbreviates both units', () => {
    expect(formatDurationShort(5)).toBe('5D/4N');
    expect(formatDurationShort(1)).toBe('1D');
  });

  it('spells it out in Bengali rather than inventing an abbreviation', () => {
    expect(formatDurationShort(5, 'bn')).toBe('৫ দিন / ৪ রাত');
  });
});
