/**
 * Site metadata in one place, for both ends of the wire.
 *
 * The SPA re-applies these tags after a client-side navigation (see
 * `components/layout/PageTitle.tsx`); the Pages Function in `functions/` renders
 * them into the HTML so a crawler or a social scraper sees them without running
 * JavaScript. One module, so the two can never disagree.
 *
 * Dependency-free on purpose. The Functions bundle resolves this by relative
 * path, where Vite's `@/` alias does not exist, so it imports nothing but
 * `./text`, and nothing here may reach for `import.meta.env`.
 */
import { humanizeDashes } from './text';

export const SITE_NAME = 'BlackPearl';
export const SITE_URL = 'https://blackpearl.bd';
/** Shown in link previews when a page has no image of its own. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;
/** Deals are priced in the site's base currency, which is what offers advertise. */
export const PRICE_CURRENCY = 'BDT';

export type OgType = 'website' | 'product' | 'article';

export interface SeoMeta {
  title: string;
  description: string;
  /** Root-relative path this page is canonical at. */
  path: string;
  ogType: OgType;
  /** Absolute image URL for previews; falls back to {@link DEFAULT_OG_IMAGE}. */
  image?: string | null;
  /** Overrides the robots meta. Absent means index, follow. */
  robots?: string | null;
  jsonLd?: Array<Record<string, unknown>>;
}

export interface PageMeta {
  title: string;
  description: string;
  ogType: OgType;
}

/** Hand-authored metadata for the public routes, in the site's own words. */
export const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'BlackPearl | Curated Tour Deals & Custom Travel Packages',
    description:
      "BlackPearl brings you curated tour deals and custom packages to the world's most amazing destinations. Browse discounted tours or build your own trip.",
    ogType: 'website',
  },
  '/deals': {
    title: 'Tour Deals | BlackPearl',
    description:
      "Browse BlackPearl's handpicked tour deals from top destinations worldwide. Find discounted tours, custom packages, and unforgettable travel experiences.",
    ogType: 'website',
  },
  '/build-package': {
    title: 'Build Your Own Package | BlackPearl',
    description:
      'Create a custom travel package tailored to your budget and tastes. Pick a destination, set your budget, and choose the activities you love.',
    ogType: 'website',
  },
  '/search': {
    title: 'Search | BlackPearl',
    description:
      'Search deals, packages, and bookmarks across BlackPearl. Find the perfect tour or custom trip for your next adventure.',
    ogType: 'website',
  },
};

/** The subset of a deal that a head tag or a structured-data node needs. */
export interface DealItineraryPhase {
  phase?: number | null;
  title?: string | null;
  description?: string | null;
}

export interface DealLike {
  title: string;
  slug: string;
  destination?: string | null;
  sub_destination?: string | null;
  short_description?: string | null;
  description?: string | null;
  image_url?: string | null;
  gallery?: string[] | null;
  price?: number | null;
  duration_days?: number | null;
  avg_rating?: number | null;
  review_count?: number | null;
  category?: string | null;
  updated_at?: string | null;
  itinerary?: DealItineraryPhase[] | null;
  inclusions?: string[] | null;
  exclusions?: string[] | null;
}

/** Root-relative, single-slash form of a path. `/deals/` becomes `/deals`. */
export function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  const withLead = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withLead.length > 1 && withLead.endsWith('/') ? withLead.slice(0, -1) : withLead;
}

/** The one URL a page is allowed to be indexed at. */
export function canonicalUrl(pathname: string): string {
  return `${SITE_URL}${normalizePath(pathname)}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `<` escaped so a `</script>` inside copy can never close the block early. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function organizationJsonLd(): Record<string, unknown> {
  return {
    '@type': 'TravelAgency',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description: PAGE_META['/'].description,
  };
}

function websiteJsonLd(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

/**
 * Metadata for a public route, or null for anything that is not one (the caller
 * then decides what to do: the SPA resets to defaults, the edge leaves the shell
 * untouched).
 */
export function routeMeta(pathname: string): SeoMeta | null {
  const path = normalizePath(pathname);
  const page = PAGE_META[path];
  if (!page) return null;

  return {
    ...page,
    path,
    jsonLd: path === '/' ? [organizationJsonLd(), websiteJsonLd()] : [],
  };
}

/** The location line a visitor reads: the specific place first, then its parent. */
function dealLocation(deal: DealLike): string {
  const parent = humanizeDashes((deal.destination || '').trim());
  const child = humanizeDashes((deal.sub_destination || '').trim());
  if (child && parent && child.toLowerCase() !== parent.toLowerCase()) return `${child}, ${parent}`;
  return child || parent;
}

/** The deal's public image, or null when it has none of its own. */
export function dealImage(deal: DealLike): string | null {
  const gallery = Array.isArray(deal.gallery) ? deal.gallery.filter(Boolean) : [];
  return deal.image_url || gallery[0] || null;
}

export function dealDescription(deal: DealLike): string {
  const copy = deal.short_description || deal.description || '';
  const cleaned = humanizeDashes(copy.trim()).replace(/\s+/g, ' ');
  if (cleaned) return cleaned.length > 300 ? `${cleaned.slice(0, 297).trimEnd()}...` : cleaned;
  const where = dealLocation(deal);
  return where
    ? `Book ${humanizeDashes(deal.title)} in ${where} with BlackPearl.`
    : `Book ${humanizeDashes(deal.title)} with BlackPearl.`;
}

/** The share title, kept under the length a preview card can show. */
export function dealTitle(deal: DealLike): string {
  const title = humanizeDashes(deal.title);
  const where = dealLocation(deal);
  return where ? `${title} | ${where} | ${SITE_NAME}` : `${title} | ${SITE_NAME}`;
}

/** Product, offer and breadcrumb trail for one deal page. */
export function dealJsonLd(deal: DealLike): Array<Record<string, unknown>> {
  const url = canonicalUrl(`/deals/${deal.slug}`);
  const image = dealImage(deal);
  const nodes: Array<Record<string, unknown>> = [];

  const product: Record<string, unknown> = {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: humanizeDashes(deal.title),
    description: dealDescription(deal),
    url,
    brand: { '@type': 'Brand', name: SITE_NAME },
  };
  if (image) product.image = [image];
  if (deal.category) product.category = humanizeDashes(deal.category);

  const price = typeof deal.price === 'number' ? deal.price : Number(deal.price ?? 0);
  if (Number.isFinite(price) && price > 0) {
    product.offers = {
      '@type': 'Offer',
      price,
      priceCurrency: PRICE_CURRENCY,
      availability: 'https://schema.org/InStock',
      url,
    };
  }

  const reviews = typeof deal.review_count === 'number' ? deal.review_count : 0;
  if (reviews > 0 && typeof deal.avg_rating === 'number') {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(deal.avg_rating.toFixed(1)),
      reviewCount: reviews,
    };
  }
  nodes.push(product);

  nodes.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tour Deals', item: canonicalUrl('/deals') },
      { '@type': 'ListItem', position: 3, name: humanizeDashes(deal.title), item: url },
    ],
  });

  if (Array.isArray(deal.gallery) && deal.gallery.length > 1) {
    nodes.push({
      '@type': 'ImageGallery',
      associatedMedia: deal.gallery
        .filter(Boolean)
        .map((src) => ({ '@type': 'ImageObject', contentUrl: src })),
    });
  }

  return nodes;
}

export function dealMeta(deal: DealLike): SeoMeta {
  return {
    title: dealTitle(deal),
    description: dealDescription(deal),
    path: `/deals/${deal.slug}`,
    ogType: 'product',
    image: dealImage(deal),
    jsonLd: dealJsonLd(deal),
  };
}

/** The crawlable list of deals, for the two pages that show one. */
export function dealListJsonLd(deals: DealLike[]): Array<Record<string, unknown>> {
  if (deals.length === 0) return [];
  return [
    {
      '@type': 'ItemList',
      itemListElement: deals.slice(0, 50).map((deal, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: canonicalUrl(`/deals/${deal.slug}`),
        name: humanizeDashes(deal.title),
      })),
    },
  ];
}

/**
 * The head tags for a page, as HTML. The caller splices this in ahead of
 * `</head>`; every value is escaped, so copy can never break out of an attribute.
 */
export function renderHead(meta: SeoMeta): string {
  const url = canonicalUrl(meta.path);
  const image = meta.image || DEFAULT_OG_IMAGE;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);

  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
  ];

  if (meta.robots) tags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}" />`);

  tags.push(
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:type" content="${meta.ogType}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  );

  return tags.join('\n    ');
}

/** The structured-data blocks for a page, as HTML. */
export function renderJsonLd(nodes: Array<Record<string, unknown>> | undefined): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes
    .map(
      (node) =>
        `<script type="application/ld+json" data-seo-jsonld>${jsonForScript({
          '@context': 'https://schema.org',
          ...node,
        })}</script>`,
    )
    .join('\n    ');
}