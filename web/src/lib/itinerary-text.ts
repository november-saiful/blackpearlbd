/**
 * Itinerary descriptions are stored as plain text, but admins write them with
 * `- ` lines for the things worth listing (pickup time, meals, what to bring).
 * The deal page turns those into a real list; everything else stays a
 * paragraph, with the author's own line breaks preserved.
 */
export type ItineraryBlock =
  | { kind: 'text'; lines: string[] }
  | { kind: 'bullets'; items: string[] };

/** A line opens a bullet when it starts with a marker and one space. */
const BULLET = /^\s*[-*•]\s+/;

export function parseItineraryDescription(description: string | null | undefined): ItineraryBlock[] {
  if (!description) return [];

  const blocks: ItineraryBlock[] = [];
  let current: ItineraryBlock | null = null;

  for (const rawLine of description.split(/\r?\n/)) {
    // Tested before the trailing whitespace goes: a bullet that is still being
    // typed is exactly `- ` with nothing after it.
    if (BULLET.test(rawLine)) {
      const item = rawLine.replace(BULLET, '').trim();
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
