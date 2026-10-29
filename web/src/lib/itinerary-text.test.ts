import { describe, expect, it } from 'vitest';
import {
  enterOnBulletLine,
  hashToBullet,
  lineStartAt,
  parseItineraryDescription,
} from './itinerary-text';

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

  it('treats a leading hash as a bullet, with or without a space', () => {
    expect(parseItineraryDescription('# Jeep to Nilgiri\n#Lunch on the hill')).toEqual([
      { kind: 'bullets', items: ['Jeep to Nilgiri', 'Lunch on the hill'] },
    ]);
  });

  it('strips a run of hashes so a pasted heading reads as one bullet', () => {
    expect(parseItineraryDescription('## Day 2: Morning beach walk')).toEqual([
      { kind: 'bullets', items: ['Day 2: Morning beach walk'] },
    ]);
  });

  it('keeps a hash inside a line as prose', () => {
    expect(parseItineraryDescription('Bring a #2 pencil.')).toEqual([
      { kind: 'text', lines: ['Bring a #2 pencil.'] },
    ]);
  });

  it('joins hash bullets and dash bullets into one list', () => {
    expect(parseItineraryDescription('- one\n# two')).toEqual([
      { kind: 'bullets', items: ['one', 'two'] },
    ]);
  });

  it('ignores a lone hash left mid-typing', () => {
    expect(parseItineraryDescription('#')).toEqual([]);
    expect(parseItineraryDescription('# kept\n#')).toEqual([
      { kind: 'bullets', items: ['kept'] },
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

describe('lineStartAt', () => {
  it('finds the start of the line under the caret', () => {
    expect(lineStartAt('one\ntwo', 5)).toBe(4);
    expect(lineStartAt('one\ntwo', 3)).toBe(0);
  });

  it('keeps a caret at the very start on the first line', () => {
    expect(lineStartAt('', 0)).toBe(0);
    expect(lineStartAt('\ntwo', 0)).toBe(0);
  });
});

describe('hashToBullet', () => {
  it('turns a hash typed at the start of a line into a bullet', () => {
    expect(hashToBullet('', 0)).toEqual({ text: '- ', caret: 2 });
  });

  it('works on a new line below existing text', () => {
    const text = 'Breakfast at the hotel\n';
    expect(hashToBullet(text, text.length)).toEqual({
      text: 'Breakfast at the hotel\n- ',
      caret: text.length + 2,
    });
  });

  it('drops the indentation the hash was typed behind', () => {
    expect(hashToBullet('   ', 3)).toEqual({ text: '- ', caret: 2 });
  });

  it('stays on the first line when the text opens with a blank line', () => {
    expect(hashToBullet('\nJeep', 0)).toEqual({ text: '- \nJeep', caret: 2 });
  });

  it('leaves the text after the caret alone', () => {
    expect(hashToBullet('Jeep to Nilgiri', 0)).toEqual({ text: '- Jeep to Nilgiri', caret: 2 });
  });

  it('ignores a hash in the middle of a sentence', () => {
    expect(hashToBullet('Bring a ', 8)).toBeNull();
    expect(hashToBullet('- already a bullet', 18)).toBeNull();
  });
});

describe('enterOnBulletLine', () => {
  it('opens the next bullet, caret after the marker', () => {
    const text = 'Breakfast at the hotel\n- Jeep to Nilgiri';
    expect(enterOnBulletLine(text, text.length)).toEqual({
      text: 'Breakfast at the hotel\n- Jeep to Nilgiri\n- ',
      caret: text.length + 3,
    });
  });

  it('ends the list when the bullet was emptied', () => {
    const text = 'Breakfast\n- ';
    expect(enterOnBulletLine(text, text.length)).toEqual({ text: 'Breakfast\n', caret: 10 });
  });

  it('leaves a plain paragraph to the browser', () => {
    expect(enterOnBulletLine('Breakfast at the hotel', 22)).toBeNull();
  });

  it('keeps a pasted hash bullet in its own style', () => {
    const text = '# Jeep to Nilgiri';
    expect(enterOnBulletLine(text, text.length)).toEqual({
      text: '# Jeep to Nilgiri\n# ',
      caret: text.length + 3,
    });
  });

  it('splits the bullet at the caret', () => {
    const text = '- Jeep to Nilgiri';
    expect(enterOnBulletLine(text, 7)).toEqual({
      text: '- Jeep \n- to Nilgiri',
      caret: 10,
    });
  });
});
