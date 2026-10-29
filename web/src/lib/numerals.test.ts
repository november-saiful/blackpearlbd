import { describe, expect, it } from 'vitest';
import { formatBengaliPrice, formatNumber, formatRating, toBengaliDigits } from './numerals';

describe('toBengaliDigits', () => {
  it('converts every digit and leaves the rest alone', () => {
    expect(toBengaliDigits('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
    expect(toBengaliDigits('BDT 4,800')).toBe('BDT ৪,৮০০');
  });

  it('leaves Bengali text untouched', () => {
    expect(toBengaliDigits('৩ দিন / ২ রাত')).toBe('৩ দিন / ২ রাত');
  });
});

describe('formatNumber', () => {
  it('keeps Latin digits in English', () => {
    expect(formatNumber(4800, 'en')).toBe('4,800');
    expect(formatNumber(150000, 'en')).toBe('150,000');
  });

  it('groups Bengali numbers the lakh way', () => {
    expect(formatNumber(4800, 'bn')).toBe('৪,৮০০');
    expect(formatNumber(150000, 'bn')).toBe('১,৫০,০০০');
  });
});

describe('formatRating', () => {
  it('keeps one decimal in either script', () => {
    expect(formatRating(4.8, 'en')).toBe('4.8');
    expect(formatRating(4.8, 'bn')).toBe('৪.৮');
  });
});

describe('formatBengaliPrice', () => {
  it('writes taka after the amount', () => {
    expect(formatBengaliPrice(4800, 'BDT')).toBe('৪,৮০০ টাকা');
    expect(formatBengaliPrice(150000, 'bdt')).toBe('১,৫০,০০০ টাকা');
  });

  it('keeps a foreign currency code so it is never called taka', () => {
    expect(formatBengaliPrice(4800, 'USD')).toBe('৪,৮০০ USD');
  });
});
