/**
 * Itinerary descriptions are stored as plain text, but admins write them with
 * `- ` lines for the things worth listing (pickup time, meals, what to bring).
 * The deal page turns those into a real list; everything else stays a
 * paragraph, with the author's own line breaks preserved.
 */
export type ItineraryBlock =
  | { kind: 'text'; lines: string[] }
  | { kind: 'bullets'; items: string[] };

/**
 * A line opens a bullet when it starts with a marker.
 *
 * `- `, `* ` and `• ` need a space after them so that prose like "-5 degrees"
 * stays prose. `#` does not: it is only ever typed to mean a bullet, and the
 * admin editor rewrites it to `- ` as soon as it is typed — the hash is still
 * accepted here so pasted lists and anything saved before that shortcut keep
 * rendering as bullets. Leading hashes are all consumed, so `## Day 2` reads
 * as a bullet too.
 *
 * Shared with the editor so the two cannot drift apart.
 */
export const BULLET_MARKER = /^\s*(?:[-*•]\s+|#+\s*)/;

/** A textarea edit: the new text and where the caret lands after it. */
export type DescriptionEdit = { text: string; caret: number };

/**
 * Where the line holding `caret` begins. The `caret <= 0` case is not the same
 * as `lastIndexOf('\n', caret - 1)`: a caret at the very start of the text sits
 * on the first line even when that line is empty, and searching from 0 would
 * jump over a newline that begins the text.
 */
export function lineStartAt(text: string, caret: number): number {
  return caret <= 0 ? 0 : text.lastIndexOf('\n', caret - 1) + 1;
}

/**
 * Typing `#` at the head of a line is the admin's shorthand for "make this a
 * bullet". Returns the rewritten text and where the caret belongs, or null when
 * the hash is just a character: mid-sentence, or behind something already
 * typed. The line's own indentation is dropped, so a bullet always starts at
 * the margin.
 */
export function hashToBullet(text: string, caret: number): DescriptionEdit | null {
  const lineStart = lineStartAt(text, caret);
  if (text.slice(lineStart, caret).trim()) return null;
  return { text: `${text.slice(0, lineStart)}- ${text.slice(caret)}`, caret: lineStart + 2 };
}

/**
 * Enter on a bullet line opens the next one, and Enter on a bullet that has
 * been emptied leaves the list instead of stacking another marker. Returns null
 * on any other line, where the browser's own newline is what should happen.
 */
export function enterOnBulletLine(text: string, caret: number): DescriptionEdit | null {
  const lineStart = lineStartAt(text, caret);
  const line = text.slice(lineStart, caret);
  const marker = BULLET_MARKER.exec(line)?.[0];
  if (!marker) return null;

  if (line.trim() === marker.trim()) {
    return { text: text.slice(0, lineStart) + text.slice(caret), caret: lineStart };
  }
  return {
    text: `${text.slice(0, caret)}\n${marker}${text.slice(caret)}`,
    caret: caret + marker.length + 1,
  };
}

export function parseItineraryDescription(description: string | null | undefined): ItineraryBlock[] {
  if (!description) return [];

  const blocks: ItineraryBlock[] = [];
  let current: ItineraryBlock | null = null;

  for (const rawLine of description.split(/\r?\n/)) {
    // Tested before the trailing whitespace goes: a bullet that is still being
    // typed is exactly `- ` with nothing after it.
    if (BULLET_MARKER.test(rawLine)) {
      const item = rawLine.replace(BULLET_MARKER, '').trim();
      if (current?.kind === 'bullets') {
        current.items.push(item);
      } else {
        current = { kind: 'bullets', items: [item] };
        blocks.push(current);
      }
      continue;
    }

    const line = rawLine.replace(/\s+$/, '');

    if (!line.trim()) {
      // A blank line ends a list, but inside a paragraph it is the author's own
      // spacing, which the page keeps by rendering the text pre-wrapped.
      if (current?.kind === 'bullets') current = null;
      else if (current?.kind === 'text') current.lines.push('');
      continue;
    }

    if (current?.kind === 'text') {
      current.lines.push(line);
    } else {
      current = { kind: 'text', lines: [line] };
      blocks.push(current);
    }
  }

  // Blank edges and empty bullets are leftovers from typing, not content.
  const cleaned: ItineraryBlock[] = [];
  for (const block of blocks) {
    if (block.kind === 'text') {
      const lines = trimBlankEdges(block.lines);
      if (lines.length > 0) cleaned.push({ kind: 'text', lines });
      continue;
    }
    const items = block.items.filter((item) => item.length > 0);
    if (items.length > 0) cleaned.push({ kind: 'bullets', items });
  }
  return cleaned;
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}
