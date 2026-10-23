export interface DealCategory {
  key: string;
  label: string;
  emoji: string;
  /** Tailwind classes for the category chip. */
  className: string;
}

interface CategoryDefinition extends DealCategory {
  /** Used only when a deal has no category stored yet. */
  keywords: string[];
}

/**
 * The category set. Keys must stay in sync with the CHECK constraint in
 * supabase/migrations/011_add_deal_category.sql and with
 * worker/src/lib/validators.ts (DEAL_CATEGORY_VALUES).
 */
export const DEAL_CATEGORIES: CategoryDefinition[] = [
  {
    key: 'beach',
    label: 'Beach & Islands',
    emoji: '🏖️',
    className: 'border-sky-300/50 bg-sky-100/50 text-sky-800 backdrop-blur-md dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300',
    keywords: ['beach', 'sea', 'island', 'coast', 'coral', 'cox', 'kuakata', 'martin', 'bay', 'snorkel', 'dive'],
  },
  {
    key: 'nature',
    label: 'Nature & Wildlife',
    emoji: '🌿',
    className: 'border-emerald-300/50 bg-emerald-100/50 text-emerald-800 backdrop-blur-md dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300',
    keywords: ['sundarban', 'mangrove', 'forest', 'wildlife', 'tiger', 'safari', 'jungle', 'national park', 'bird', 'haor', 'wetland'],
  },
  {
    key: 'hill',
    label: 'Hills & Tea',
    emoji: '⛰️',
    className: 'border-teal-300/50 bg-teal-100/50 text-teal-800 backdrop-blur-md dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300',
    keywords: ['hill', 'tea', 'bandarban', 'rangamati', 'sylhet', 'srimangal', 'mountain', 'valley', 'tribal', 'cloud'],
  },
  {
    key: 'river',
    label: 'Rivers & Cruises',
    emoji: '🚤',
    className: 'border-blue-300/50 bg-blue-100/50 text-blue-800 backdrop-blur-md dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300',
    keywords: ['river', 'cruise', 'boat', 'launch', 'padma', 'lake', 'canal', 'houseboat'],
  },
  {
    key: 'heritage',
    label: 'Heritage & Culture',
    emoji: '🏛️',
    className: 'border-amber-300/50 bg-amber-100/50 text-amber-800 backdrop-blur-md dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300',
    keywords: ['heritage', 'culture', 'museum', 'fort', 'palace', 'mosque', 'temple', 'historic', 'history', 'old town', 'bazaar', 'city tour', 'dhaka'],
  },
  {
    key: 'adventure',
    label: 'Adventure',
    emoji: '🧭',
    className: 'border-orange-300/50 bg-orange-100/50 text-orange-800 backdrop-blur-md dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-300',
    keywords: ['trek', 'trekking', 'hike', 'hiking', 'camp', 'camping', 'rafting', 'adventure', 'kayak', 'zipline', 'rappelling'],
  },
  {
    key: 'tour',
    label: 'Guided Tour',
    emoji: '🧳',
    className: 'glass-chip text-muted-foreground',
    keywords: [],
  },
];

export const DEFAULT_DEAL_CATEGORY = DEAL_CATEGORIES[DEAL_CATEGORIES.length - 1];

/** The category stored on a deal, if it is one we know how to render. */
export function getCategoryByKey(key?: string | null): DealCategory | null {
  if (!key) return null;
  return DEAL_CATEGORIES.find((category) => category.key === key) ?? null;
}

/** Strips the keyword list so callers only ever see presentation data. */
function toCategory({ keywords: _keywords, ...category }: CategoryDefinition): DealCategory {
  return category;
}

/**
 * Category for a deal. Uses the stored `category` column when an admin has set
 * one, and falls back to guessing from the deal's own words for older rows that
 * were never categorised.
 */
export function getDealCategory(deal: {
  title?: string | null;
  destination?: string | null;
  short_description?: string | null;
  category?: string | null;
}): DealCategory {
  const stored = getCategoryByKey(deal.category);
  if (stored) return toCategory(stored as CategoryDefinition);

  const haystack = [deal.title, deal.destination, deal.short_description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matched = DEAL_CATEGORIES.find(
    (category) =>
      category.keywords.length > 0 &&
      category.keywords.some((keyword) => haystack.includes(keyword)),
  );

  return matched ? toCategory(matched) : DEFAULT_DEAL_CATEGORY;
}
