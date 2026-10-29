import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, resolveLocale } from './locale';

describe('resolveLocale', () => {
  it('opens in Bangla for someone who has never chosen', () => {
    expect(DEFAULT_LOCALE).toBe('bn');
    expect(resolveLocale(null)).toBe('bn');
  });

  it('keeps an explicit English choice', () => {
    expect(resolveLocale('en')).toBe('en');
  });

  it('treats anything unrecognised as no choice, not as English', () => {
    expect(resolveLocale('')).toBe('bn');
    expect(resolveLocale('fr')).toBe('bn');
    expect(resolveLocale('bn')).toBe('bn');
  });
});
