import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Package, Bookmark, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const typeConfig: Record<string, { label: string; color: string; icon: typeof Search }> = {
  deal: { label: 'Tour Deal', color: 'bg-primary/10 text-primary', icon: MapPin },
  bookmark: { label: 'Bookmark', color: 'bg-amber-500/10 text-amber-600', icon: Bookmark },
  package: { label: 'Package', color: 'bg-emerald-500/10 text-emerald-600', icon: Package },
};

function SearchResultCard({ result }: { result: SearchResult }) {
  const config = typeConfig[result.type];
  const Icon = config.icon;

  return (
    <Link
      to={result.href}
      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
    >
      {result.imageUrl ? (
        <img
          src={result.imageUrl}
          alt={result.title}
          className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5 sm:mb-1">
          <h3 className="text-sm font-medium text-foreground truncate">{result.title}</h3>
          <Badge className={`text-[10px] flex-shrink-0 ${config.color}`}>{config.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
        {result.price !== undefined && (
          <p className="text-sm font-semibold text-primary mt-0.5 sm:mt-1">
            {formatCurrency(result.price)}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);

  const { results } = useGlobalSearch(query);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setSearchParams({ q: value.trim() });
    } else {
      setSearchParams({});
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    results.forEach((r) => {
      const group = typeConfig[r.type]?.label || 'Results';
      const items = map.get(group) || [];
      items.push(r);
      map.set(group, items);
    });
    return Array.from(map.entries());
  }, [results]);

  return (
    <div className="site-container py-4 sm:py-6 lg:py-8">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to home
      </Link>

      {/* Search input */}
      <div className="relative mb-5 sm:mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
        <Input
          placeholder="Search deals, packages, bookmarks..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 sm:pl-11 h-10 sm:h-12 text-sm sm:text-base"
        />
      </div>

      {/* Results */}
      {!query.trim() ? (
        <div className="text-center py-10 sm:py-16">
          <Search className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground/30 mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-muted-foreground">Start typing to search across deals, packages, and bookmarks</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-10 sm:py-16">
          <Search className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground/30 mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-muted-foreground">No results found for "{query}"</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Try a different keyword or check spelling</p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>

          {grouped.map(([group, items]) => (
            <div key={group}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {group}
              </h2>
              <div className="space-y-2">
                {items.map((result) => (
                  <SearchResultCard key={result.id} result={result} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
