import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_ALIGN, TEXT_ALIGN_VALUES, isTextAlign, textAlignClass } from './text-align';

describe('isTextAlign', () => {
  it('accepts every value the column allows', () => {
    for (const value of TEXT_ALIGN_VALUES) expect(isTextAlign(value)).toBe(true);
  });

  it('rejects anything else, including the shapes a bad row holds', () => {
    expect(isTextAlign('centre')).toBe(false);
    expect(isTextAlign('Justify')).toBe(false);
    expect(isTextAlign('')).toBe(false);
    expect(isTextAlign(null)).toBe(false);
    expect(isTextAlign(undefined)).toBe(false);
    expect(isTextAlign(3)).toBe(false);
  });
});

describe('textAlignClass', () => {
  it('names the class for each alignment', () => {
    expect(textAlignClass('center')).toBe('text-center');
    expect(textAlignClass('right')).toBe('text-right');
    expect(textAlignClass('left')).toBe('text-left');
  });

  it('draws nothing for the default, so an unchosen alignment adds no class', () => {
    expect(textAlignClass('justify')).toBeUndefined();
    expect(DEFAULT_TEXT_ALIGN).toBe('justify');
  });

  it('falls back to the default for a value this build cannot draw', () => {
    expect(textAlignClass(null)).toBeUndefined();
    expect(textAlignClass(undefined)).toBeUndefined();
    expect(textAlignClass('centre')).toBeUndefined();
    expect(textAlignClass(7)).toBeUndefined();
  });
});
