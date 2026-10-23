import { describe, expect, it } from 'vitest';
import { imagePreload, leadPhotoPreload } from './lead-photo';
import type { DealLike } from '../../src/lib/seo';

const deal = (over: Partial<DealLike>): DealLike => ({ title: 'T', slug: 't', ...over });

describe('leadPhotoPreload', () => {
  it('names the newest deal, which is the one the grid paints first', () => {
    const html = leadPhotoPreload([
      deal({ slug: 'newest', image_url: 'https://cdn.example/newest.webp' }),
      deal({ slug: 'older', image_url: 'https://cdn.example/older.webp' }),
    ]);
    expect(html).toContain('href="https://cdn.example/newest.webp"');
  });

  it('is silent when the catalogue or its lead photo is missing', () => {
    expect(leadPhotoPreload([])).toBe('');
    expect(leadPhotoPreload([deal({ slug: 'bare' })])).toBe('');
    expect(leadPhotoPreload([deal({ slug: 'empty', image_url: '' })])).toBe('');
  });

  it('carries the priority the picture needs to beat the fonts to the wire', () => {
    expect(imagePreload('https://cdn.example/a.webp')).toBe(
      '<link rel="preload" as="image" fetchpriority="high" href="https://cdn.example/a.webp" />',
    );
  });

  it('quotes a URL that contains an attribute delimiter', () => {
    expect(imagePreload('https://cdn.example/a.webp?x=1&y="2"')).toBe(
      '<link rel="preload" as="image" fetchpriority="high" href="https://cdn.example/a.webp?x=1&amp;y=&quot;2&quot;" />',
    );
  });
});
