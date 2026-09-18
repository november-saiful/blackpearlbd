import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { AnimatedBookmarkButton } from "@/components/deals/AnimatedBookmarkButton";
import { DealCard } from "@/components/deals/DealCard";
import { useBookmarkStore } from "@/stores/bookmarkStore";
import type { TourDeal } from "@/types";

export type Department = string;

export interface JobListing {
  id: string;
  title: string;
  description: string;
  location: string;
  type: string;
  salaryRange: string;
  department: Department;
  href?: string;
  tags?: string[];
  /** The full deal — the card renders itself straight from this. */
  deal: TourDeal;
}

/** A single experience-category chip, alongside the destination tabs. */
export interface CategoryFilter {
  key: string;
  label: string;
  emoji: string;
  count: number;
  /** Tailwind classes for the chip when it is the active filter. */
  className?: string;
}

export interface Career3Props {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  /**
   * Destination tabs. Optional: leave them out when the caller owns filtering,
   * and every job renders instead of the tab's slice of them.
   */
  departments?: Department[];
  jobs: JobListing[];
  /**
   * Replaces the tab and chip chrome with a filter surface the caller owns, so
   * a page can filter by more than one axis without stacking a second control
   * under this one.
   */
  toolbar?: ReactNode;
  exploreLabel?: string;
  exploreHref?: string;
  emptyMessage?: string;
  /** Department tab to pre-select on mount (e.g. from a ?destination= URL param) */
  defaultDepartment?: Department;
  /** Optional experience-category chips rendered under the destination tabs */
  categories?: CategoryFilter[];
  /** Currently active category key, or "all" */
  activeCategory?: string;
  onCategoryChange?: (key: string) => void;
  /**
   * Notified with the effective department tab (on mount and on every change),
   * so a parent can scope sibling filters to the tab that is actually showing.
   */
  onDepartmentChange?: (department: Department) => void;
}

interface JobCardProps {
  job: JobListing;
}

function JobCard({ job }: JobCardProps) {
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();
  const bookmarked = isBookmarked(job.id);

  return (
    <DealCard
      deal={job.deal}
      action={
        <AnimatedBookmarkButton
          isBookmarked={bookmarked}
          onClick={() => (bookmarked ? removeBookmark(job.id) : addBookmark(job.deal))}
          className="rounded-full bg-white/90 shadow-md backdrop-blur-sm hover:bg-white"
        />
      }
    />
  );
}

export default function Career3({
  eyebrow = "Discover your next adventure",
  heading,
  subheading,
  departments,
  jobs,
  toolbar,
  exploreLabel = "View all tours",
  exploreHref = "#",
  emptyMessage = "No tours found in this category right now.",
  defaultDepartment,
  categories,
  activeCategory = "all",
  onCategoryChange,
  onDepartmentChange,
}: Career3Props) {
  const tabs = departments && departments.length > 0 ? departments : null;
  const [active, setActive] = useState<Department>(defaultDepartment ?? tabs?.[0] ?? "All");

  useEffect(() => {
    onDepartmentChange?.(active);
  }, [active, onDepartmentChange]);

  // No tabs means no department scoping: the caller's own filter has already
  // decided what belongs on screen.
  const filtered =
    !tabs || active === "All" ? jobs : jobs.filter((j) => j.department === active);

  const totalInCategories = (categories ?? []).reduce((sum, c) => sum + c.count, 0);

  return (
    <section className="h-full w-full pb-10 pt-6 sm:py-16 lg:py-20">
      <div className="flex flex-col items-center text-center">
        <Badge
          variant="outline"
          className="mb-3 rounded-full px-3.5 py-1 text-[11px] font-medium tracking-wide sm:mb-4 sm:px-4 sm:text-xs"
        >
          {eyebrow}
        </Badge>

        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          {heading}
        </h1>

        {subheading && (
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:mt-4 sm:text-lg">
            {subheading}
          </p>
        )}
      </div>

      {toolbar ? (
        <div className="mt-6 sm:mt-10">{toolbar}</div>
      ) : (
        tabs && (
          /*
           * Destination tabs. On phones this is a horizontally scrollable
           * segmented control: the pill keeps the site gutter, the row snaps to
           * each tab, and every option is a 40px-tall tap target.
           */
          <div className="mt-6 flex w-full justify-center sm:mt-10">
            <div className="no-scrollbar w-full max-w-6xl snap-x scroll-pl-1 overflow-x-auto rounded-full border border-border bg-muted p-1">
              <div className="flex min-w-max items-center justify-start gap-1 md:min-w-full md:justify-center">
                {tabs.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setActive(dept)}
                    aria-pressed={active === dept}
                    className={`min-h-10 shrink-0 snap-start rounded-full px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-5 ${
                      active === dept
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {/*
       * Experience chips, shown only when this component owns the chrome. On
       * phones the row bleeds out to the screen edge (negative gutter + matching
       * padding) so chips scroll off the edge instead of being clipped
       * mid-gutter, and the chips are tall enough to tap. From sm up they simply
       * wrap and stay centred.
       */}
      {!toolbar && categories && categories.length > 0 && (
        <div
          role="group"
          aria-label="Filter tours by experience"
          className="no-scrollbar -mx-[var(--site-gutter)] mt-3 flex snap-x scroll-pl-[var(--site-gutter)] items-center gap-2 overflow-x-auto px-[var(--site-gutter)] pb-1 sm:mx-0 sm:mt-4 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
        >
          {[
            { key: "all", label: "All experiences", emoji: "✨", count: totalInCategories, className: undefined },
            ...categories,
          ].map((category) => {
            const isActive = activeCategory === category.key;
            return (
              <button
                key={category.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => onCategoryChange?.(category.key)}
                className={`inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  isActive
                    ? category.className ?? "border-foreground/20 bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                } ${isActive ? "shadow-sm ring-1 ring-current/20" : ""}`}
              >
                <span aria-hidden="true">{category.emoji}</span>
                {category.label}
                <span
                  className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                    isActive ? "bg-black/10 dark:bg-white/15" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {category.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 sm:mt-10">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground sm:py-16">
            {emptyMessage}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 sm:mt-14">
        <p className="text-sm text-muted-foreground">
          Looking for something else?
        </p>
        <Button
          variant="link"
          asChild
          className="group h-auto min-h-10 gap-1.5 px-2 text-sm font-semibold hover:no-underline"
        >
          <a href={exploreHref}>
            {exploreLabel}
            <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        </Button>
      </div>
    </section>
  );
}
