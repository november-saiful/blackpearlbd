const EM_DASH = '\u2014';
const EN_DASH = '\u2013';
const MONTHS = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*$/i;

/**
 * A lead-in this short reads as a label ("Kashmir"), so it takes a colon; past
 * that it is a continuation and takes a comma.
 */
const LABEL_WORD_LIMIT = 4;

function endsSentence(text: string): boolean {
  return /[.!?]\s*$/.test(text);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Rejoin the clauses a spaced dash was standing between. */
function joinClauses(segments: string[]): string {
  let out = segments[0].trim();
  for (let i = 1; i < segments.length; i++) {
    const previous = segments[i - 1].trim();
    const next = segments[i].trim();
    if (!next) continue;
    if (endsSentence(previous)) {
      out += ` ${next.charAt(0).toUpperCase()}${next.slice(1)}`;
    } else if (i === 1 && wordCount(previous) <= LABEL_WORD_LIMIT) {
      out += `: ${next}`;
    } else {
      out += `, ${next}`;
    }
  }
  return out;
}

function isMonth(word: string): boolean {
  return MONTHS.test(word);
}

/**
 * Rewrite em and en dashes into punctuation a person would type: ranges become
 * "to", a short lead-in takes a colon, and a longer clause takes a comma.
 *
 * Copy typed into the admin arrives from the database exactly as written, so
 * every surface that shows that copy runs it through here. Without this a deal
 * titled "Kashmir — Paradise on Earth" would put back what the source sweep
 * removed.
 */
export function humanizeDashes(value: string): string {
  if (!value || (!value.includes(EM_DASH) && !value.includes(EN_DASH))) return value;

  let text = value;

  // Ranges and spans: "৳5,000 – ৳10,000" and "2026 – 2027".
  text = text.replace(/([\d৳])\s*[–—]\s*(?=[\d৳])/g, '$1 to ');
  // Month spans: "Nov – Feb".
  text = text.replace(/(\b[A-Za-z]{3,9})\s*[–—]\s*(?=[A-Za-z]{3,9}\b)/g, (match, left) =>
    isMonth(left) ? `${left} to ` : match,
  );

  // Whatever is left joins two clauses. Only a dash with whitespace on both
  // sides is treated as a clause break: an unspaced one is a compound ("Hill
  // tracts–tea gardens") or a range already handled above.
  const parts = text.split(/\s+[–—]\s+/);
  if (parts.length > 1) {
    text = joinClauses(parts);
  }

  // An unspaced dash is a stray aside; a comma reads as the aside it was meant
  // to be.
  return text.split(EM_DASH).join(', ').split(EN_DASH).join(', ');
}

const TEXT_FIELDS = ['title', 'short_description', 'description', 'destination', 'sub_destination'] as const;
const TEXT_LISTS = ['inclusions', 'exclusions'] as const;

/**
 * Apply {@link humanizeDashes} to every text field of a deal, including its
 * itinerary phases and its inclusion/exclusion lists. Returns the original
 * object untouched when there is nothing to change, so referential identity
 * (and any memo depending on it) holds.
 */
export function humanizeDealText<T extends Record<string, any>>(deal: T): T {
  let changed = false;
  const next: Record<string, any> = { ...deal };

  for (const field of TEXT_FIELDS) {
    const value = next[field];
    if (typeof value !== 'string') continue;
    const cleaned = humanizeDashes(value);
    if (cleaned !== value) {
      next[field] = cleaned;
      changed = true;
    }
  }

  for (const field of TEXT_LISTS) {
    const value = next[field];
    if (!Array.isArray(value)) continue;
    const cleaned = value.map((item) => (typeof item === 'string' ? humanizeDashes(item) : item));
    if (cleaned.some((item, index) => item !== value[index])) {
      next[field] = cleaned;
      changed = true;
    }
  }

  if (Array.isArray(next.itinerary)) {
    const itinerary = next.itinerary.map((phase: any) => {
      if (!phase || typeof phase !== 'object') return phase;
      const title = typeof phase.title === 'string' ? humanizeDashes(phase.title) : phase.title;
      const description =
        typeof phase.description === 'string' ? humanizeDashes(phase.description) : phase.description;
      if (title === phase.title && description === phase.description) return phase;
      changed = true;
      return { ...phase, title, description };
    });
    next.itinerary = itinerary;
  }

  return changed ? (next as T) : deal;
}