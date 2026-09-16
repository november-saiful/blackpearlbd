import { useNavigate } from 'react-router-dom';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxTrigger, ComboboxValue, ComboboxContent, ComboboxInput, ComboboxList, ComboboxItem, ComboboxEmpty, ComboboxGroup, ComboboxSeparator } from '@/components/ui/combobox';
import { DateRangePicker } from '@/components/base/date-picker/date-range-picker';
import { parseDate } from '@internationalized/date';
import type { DateValue } from 'react-aria-components';
import { Button } from '@/components/ui/button';
import { PackageSummary } from './PackageSummary';
import { useGeoLocation, formatDateInTimezone } from '@/hooks/useGeoLocation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BANGLADESH_DIVISIONS, type Division, type District, type TourSpot } from '@/data/bangladesh-tourist-spots';
import { api } from '@/lib/api';
import type { PackageDestination } from '@/types';

// ── SVG Icons ────────────────────────────────────────────────────────
const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
  </svg>
);

const CheckSvg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── Destination data ──────────────────────────────────────────────

type DestinationItem = {
  value: string;          // slug for combobox selection
  name: string;           // display name
};

type CategoryGroup = {
  category: string;       // group header
  items: DestinationItem[];
};

// Fallback hardcoded destinations (used if API fails)
const FALLBACK_DESTINATION_GROUPS: CategoryGroup[] = [
  {
    category: 'Bangladesh',
    items: [
      { value: 'bangladesh-customized', name: 'Bangladesh (Customized)' },
      ...BANGLADESH_DIVISIONS.map((d) => ({
        value: d.name.toLowerCase().replace(/\s+/g, '-'),
        name: d.name,
      })),
    ],
  },
  {
    category: 'Asia',
    items: [
      { value: 'thailand', name: 'Thailand' },
      { value: 'malaysia', name: 'Malaysia' },
      { value: 'indonesia', name: 'Indonesia' },
      { value: 'united-arab-emirates', name: 'United Arab Emirates' },
      { value: 'maldives', name: 'Maldives' },
      { value: 'nepal', name: 'Nepal' },
      { value: 'japan', name: 'Japan' },
    ],
  },
  {
    category: 'Asia / Europe',
    items: [{ value: 'turkey', name: 'Turkey' }],
  },
  {
    category: 'Europe',
    items: [
      { value: 'switzerland', name: 'Switzerland' },
      { value: 'france', name: 'France' },
    ],
  },
];

/** Convert flat PackageDestination rows into CategoryGroup[] */
function groupDestinations(rows: PackageDestination[]): CategoryGroup[] {
  const map = new Map<string, DestinationItem[]>();
  for (const row of rows) {
    if (!map.has(row.category)) map.set(row.category, []);
    map.get(row.category)!.push({ value: row.value, name: row.name });
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

/** Determine if a destination value is a Bangladesh customization option */
function isBangladeshDestination(value: string): boolean {
  return value === 'bangladesh-customized' || value.endsWith('-division');
}

/** Get the Division object for a selected value */
function getDivisionForValue(value: string): Division | undefined {
  return BANGLADESH_DIVISIONS.find(
    (d) => d.name.toLowerCase().replace(/\s+/g, '-') === value,
  );
}

// ── Date helpers ───────────────────────────────────────────────────
type DateRangeValue = { start: DateValue; end: DateValue } | null;
const MONTHS = [
  { label: 'January', value: '01' },
  { label: 'February', value: '02' },
  { label: 'March', value: '03' },
  { label: 'April', value: '04' },
  { label: 'May', value: '05' },
  { label: 'June', value: '06' },
  { label: 'July', value: '07' },
  { label: 'August', value: '08' },
  { label: 'September', value: '09' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
];

function formatDateDisplay(month: string, day: string, year: string) {
  const m = MONTHS.find((mo) => mo.value === month);
  return `${m?.label ?? month} ${parseInt(day)}, ${year}`;
}

// ── DatePicker button + popover ──────────────────────────────────────
// ── Step labels ──────────────────────────────────────────────────────
const STEP_LABELS = [
  { title: 'Destination & Dates', description: 'Where and when do you want to travel?' },
  { title: 'Preferences', description: 'Customize your travel experience' },
  { title: 'Review', description: 'Review and submit your package' },
];

// ── SessionStorage persistence ─────────────────────────────────────
const STORAGE_KEY = 'build-package-form';

type SavedState = {
  step: number;
  destination: string;
  fromMonth: string;
  fromDay: string;
  fromYear: string;
  toMonth: string;
  toDay: string;
  toYear: string;
  selectedDivision?: string;
  selectedDistrict?: string;
  selectedDistricts?: string[];
  selectedTourSpots?: string[];
};

function loadSavedState(): SavedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

interface BuildPackageFormProps {
  /** Render only step one inside the Home page quick-access tab. */
  embedded?: boolean;
}

// ── Main Component ───────────────────────────────────────────────────
export default function BuildPackage({ embedded = false }: BuildPackageFormProps) {
  const navigate = useNavigate();
  const saved = useMemo(() => loadSavedState(), []);
  const geo = useGeoLocation();
  const pad = (n: number) => String(n).padStart(2, '0');

  // Date defaults – today / tomorrow, resolved in the visitor's timezone
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  // Get today's date parts in the visitor's timezone
  const todayInTz = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: geo.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = fmt.formatToParts(today);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      return { month: get('month'), day: get('day'), year: get('year') };
    } catch {
      return {
        month: pad(today.getMonth() + 1),
        day: pad(today.getDate()),
        year: String(today.getFullYear()),
      };
    }
  }, [geo.timezone, today]);

  const tomorrowInTz = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: geo.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = fmt.formatToParts(tomorrow);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      return { month: get('month'), day: get('day'), year: get('year') };
    } catch {
      return {
        month: pad(tomorrow.getMonth() + 1),
        day: pad(tomorrow.getDate()),
        year: String(tomorrow.getFullYear()),
      };
    }
  }, [geo.timezone, tomorrow]);

  const [step, setStep] = useState(embedded ? 1 : (saved?.step ?? 1));
  const [destination, setDestination] = useState(saved?.destination ?? '');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch package destinations from API
  const [destinationGroups, setDestinationGroups] = useState<CategoryGroup[]>(FALLBACK_DESTINATION_GROUPS);

  useEffect(() => {
    api
      .getPackageDestinations()
      .then(({ destinations }) => {
        if (destinations.length > 0) {
          setDestinationGroups(groupDestinations(destinations));
        }
      })
      .catch(() => {
        // Keep fallback data on error
      });
  }, []);

  // Bangladesh customization state
  const [selectedDivision, setSelectedDivision] = useState<string>(saved?.selectedDivision ?? '');
  const [selectedDistrict, setSelectedDistrict] = useState<string>(saved?.selectedDistrict ?? '');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(saved?.selectedDistricts ?? []);
  const [selectedTourSpots, setSelectedTourSpots] = useState<string[]>(saved?.selectedTourSpots ?? []);

  // Reset BD sub-selections when destination changes
  useEffect(() => {
    if (!isBangladeshDestination(destination)) {
      setSelectedDivision('');
      setSelectedDistrict('');
      setSelectedDistricts([]);
      setSelectedTourSpots([]);
    } else if (destination !== 'bangladesh-customized') {
      // A specific division was selected directly — sync it
      const div = getDivisionForValue(destination);
      setSelectedDivision(div?.name ?? '');
      setSelectedDistrict('');
      setSelectedDistricts([]);
      setSelectedTourSpots([]);
    } else {
      // 'bangladesh-customized' selected — reset sub-selections
      setSelectedDivision('');
      setSelectedDistrict('');
      setSelectedDistricts([]);
      setSelectedTourSpots([]);
    }
  }, [destination]);

  const currentDivision = useMemo(() => {
    if (!selectedDivision) return undefined;
    return BANGLADESH_DIVISIONS.find((d) => d.name === selectedDivision);
  }, [selectedDivision]);

  const currentDistrict = useMemo(() => {
    if (!currentDivision || !selectedDistrict) return undefined;
    return currentDivision.districts.find((d) => d.name === selectedDistrict);
  }, [currentDivision, selectedDistrict]);

  const isCustomized = destination === 'bangladesh-customized';

  const handleDivisionChange = (divisionName: string) => {
    setSelectedDivision(divisionName);
    setSelectedDistrict('');
    setSelectedDistricts([]);
    setSelectedTourSpots([]);
  };

  const handleDistrictChange = (districtName: string) => {
    setSelectedDistrict(districtName);
    setSelectedTourSpots([]);
  };

  const toggleDistrict = (districtName: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(districtName)
        ? prev.filter((d) => d !== districtName)
        : [...prev, districtName],
    );
  };

  const toggleTourSpot = (spotName: string) => {
    setSelectedTourSpots((prev) =>
      prev.includes(spotName)
        ? prev.filter((s) => s !== spotName)
        : [...prev, spotName],
    );
  };

  // For customized mode: collect all districts and their tour spots from selected districts
  const customizedTourSpots = useMemo(() => {
    if (!currentDivision || !isCustomized || selectedDistricts.length === 0) return [];
    return currentDivision.districts
      .filter((d) => selectedDistricts.includes(d.name))
      .map((d) => ({ district: d.name, tourSpots: d.tourSpots }));
  }, [currentDivision, isCustomized, selectedDistricts]);

  const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
    if (saved?.fromYear && saved?.fromMonth && saved?.fromDay && saved?.toYear && saved?.toMonth && saved?.toDay) {
      try {
        return {
          start: parseDate(`${saved.fromYear}-${saved.fromMonth}-${saved.fromDay}`),
          end: parseDate(`${saved.toYear}-${saved.toMonth}-${saved.toDay}`),
        };
      } catch {
        // fall through to defaults
      }
    }
    return {
      start: parseDate(`${todayInTz.year}-${todayInTz.month}-${todayInTz.day}`),
      end: parseDate(`${tomorrowInTz.year}-${tomorrowInTz.month}-${tomorrowInTz.day}`),
    };
  });

  // Derived display parts (summary sidebar, review, sessionStorage)
  const fromMonth = dateRange ? pad(dateRange.start.month) : '';
  const fromDay = dateRange ? pad(dateRange.start.day) : '';
  const fromYear = dateRange ? String(dateRange.start.year) : '';
  const toMonth = dateRange ? pad(dateRange.end.month) : '';
  const toDay = dateRange ? pad(dateRange.end.day) : '';
  const toYear = dateRange ? String(dateRange.end.year) : '';

  const persistState = useCallback((nextStep = step) => {
    const state: SavedState = {
      step: nextStep,
      destination,
      fromMonth,
      fromDay,
      fromYear,
      toMonth,
      toDay,
      toYear,
      selectedDivision,
      selectedDistrict,
      selectedDistricts,
      selectedTourSpots,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // quota exceeded – silently ignore
    }
  }, [step, destination, fromMonth, fromDay, fromYear, toMonth, toDay, toYear, selectedDivision, selectedDistrict, selectedDistricts, selectedTourSpots]);

  // Persist to sessionStorage on every relevant change
  useEffect(() => {
    persistState();
  }, [persistState]);

  const canNext = useMemo(() => {
    if (step === 1) {
      if (!destination || !fromMonth || !fromDay || !fromYear || !toMonth || !toDay || !toYear) return false;
      // If Bangladesh destination, require district selection
      if (isBangladeshDestination(destination)) {
        if (isCustomized) {
          return selectedDistricts.length > 0;
        }
        return !!selectedDistrict;
      }
    }
    return true;
  }, [step, destination, fromMonth, fromDay, fromYear, toMonth, toDay, toYear, selectedDistrict, selectedDistricts, isCustomized]);

  const scrollToTop = () => {
    const container = document.querySelector('.overflow-y-auto');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = useCallback(() => {
    if (step < 3 && canNext) {
      const nextStep = step + 1;
      setStep(nextStep);
      // Save before navigating so the full builder opens directly at step two.
      if (embedded) persistState(nextStep);
      if (embedded) {
        navigate('/build-package');
      } else {
        scrollToTop();
      }
    }
  }, [step, canNext, embedded, navigate, persistState]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep(step - 1);
      scrollToTop();
    }
  }, [step]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 2000);
    },
    [],
  );

  // "To" date is normalized by the range picker; keep aliases for display
  const effectiveToMonth = toMonth;
  const effectiveToDay = toDay;
  const effectiveToYear = toYear;

  // Build combined travel date string for the sidebar
  const travelDateDisplay = geo.loaded
    ? formatDateInTimezone(fromMonth, fromDay, fromYear, geo.timezone)
    : formatDateDisplay(fromMonth, fromDay, fromYear);

  return (
    <div className={embedded ? "w-full" : "site-container pt-8 pb-24"}>
      <div className={embedded ? "w-full" : "grid lg:grid-cols-3 gap-8"}>
        {/* ── Left column: form ── */}
        <div className={embedded ? "w-full space-y-6" : "lg:col-span-2 space-y-6 min-w-0"}>
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-foreground">
                Step {step} of 3
              </span>
              <span className="text-sm text-muted-foreground">
                {Math.round((step / 3) * 100)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-primary h-2 rounded-full"
                initial={false}
                animate={{ width: `${(step / 3) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </div>

          {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "rounded-lg p-6 min-w-0",
              embedded
                ? "w-full"
                : "bg-card border border-border shadow-sm",
            )}
          >
          {/* Header */}
          <div className="relative text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-muted rounded-full mb-4">
              <MapPin className="h-5 w-5 text-foreground" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Build Your Package
            </h1>
            <p className="text-sm text-muted-foreground">
              {STEP_LABELS[step - 1].description}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {/* ── Step 1: Destination & Dates ── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Destination Combobox */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Destination
                    </label>
                    <Combobox value={destination} onValueChange={setDestination}>
                      <ComboboxTrigger>
                        <ComboboxValue placeholder="Select destination" />
                      </ComboboxTrigger>
                      <ComboboxContent className="w-full max-w-[380px]">
                        <ComboboxInput placeholder="Search destinations..." />
                        <ComboboxList className="max-h-[400px]">
                          <ComboboxEmpty>No destination found.</ComboboxEmpty>
                          {destinationGroups.map((group, groupIndex) => (
                            <React.Fragment key={group.category}>
                              {groupIndex > 0 ? <ComboboxSeparator /> : null}
                              <ComboboxGroup>
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                  {group.category}
                                </div>
                                {group.items.map((item) => (
                                  <ComboboxItem
                                    key={item.value}
                                    value={item.value}
                                    textValue={item.name}
                                    keywords={[group.category, item.name]}
                                    className="py-2"
                                  >
                                    <span className="flex min-w-0 items-center gap-2.5">
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium text-foreground">
                                          {item.name}
                                        </span>
                                      </span>
                                    </span>
                                  </ComboboxItem>
                                ))}
                              </ComboboxGroup>
                            </React.Fragment>
                          ))}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>

                  {/* ── Destination Preview ── */}
                  {destination && (() => {
                    const dest = destinationGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.category }))).find((i) => i.value === destination);
                    if (!dest) return null;
                    return (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="rounded-lg border border-border bg-muted/50 overflow-hidden"
                      >
                        <div className="p-4">
                          <h4 className="text-sm font-medium text-foreground mb-1">
                            {dest.name}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {dest.group}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })()}

                  {/* ── Bangladesh Customization: Division → District → Tour Spots ── */}
                  {isBangladeshDestination(destination) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-lg border border-border bg-muted/50 overflow-hidden space-y-4"
                    >
                      <div className="p-4 space-y-4">
                        {/* Division select (only when "Customized" is chosen) */}
                        {destination === 'bangladesh-customized' && (
                          <div>
                            <Label className="text-sm font-medium text-foreground">Division</Label>
                            <Select
                              value={selectedDivision}
                              onValueChange={handleDivisionChange}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select a division" />
                              </SelectTrigger>
                              <SelectContent>
                                {BANGLADESH_DIVISIONS.map((div) => (
                                  <SelectItem key={div.name} value={div.name}>
                                    {div.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* District select (cascading from division) */}
                        {currentDivision && isCustomized && (
                          <div>
                            <Label className="text-sm font-medium text-foreground">
                              Districts{' '}
                              <span className="text-muted-foreground font-normal">
                                ({selectedDistricts.length} selected)
                              </span>
                            </Label>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {currentDivision.districts.map((dist) => (
                                <label
                                  key={dist.name}
                                  className={cn(
                                    'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                                    selectedDistricts.includes(dist.name)
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border bg-card hover:bg-accent/50',
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedDistricts.includes(dist.name)}
                                    onChange={() => toggleDistrict(dist.name)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                                  />
                                  <span className="text-sm text-foreground">
                                    {dist.name}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* District select — single (for specific division selections) */}
                        {currentDivision && !isCustomized && (
                          <div>
                            <Label className="text-sm font-medium text-foreground">District</Label>
                            <Select
                              value={selectedDistrict}
                              onValueChange={handleDistrictChange}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select a district" />
                              </SelectTrigger>
                              <SelectContent>
                                {currentDivision.districts.map((dist) => (
                                  <SelectItem key={dist.name} value={dist.name}>
                                    {dist.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Tour spots — read-only details (customized mode) */}
                        {isCustomized && customizedTourSpots.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium text-foreground">
                              Tour Spots in Selected Districts
                            </Label>
                            <div className="mt-2 space-y-3">
                              {customizedTourSpots.map((group) => (
                                <div
                                  key={group.district}
                                  className="rounded-lg border border-border bg-card p-3"
                                >
                                  <h5 className="text-sm font-semibold text-foreground mb-2">
                                    {group.district}
                                  </h5>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {group.tourSpots.map((spot) => (
                                      <span
                                        key={spot.name}
                                        className="inline-block rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium"
                                      >
                                        {spot.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tour spots checkboxes (cascading from district — specific division mode) */}
                        {!isCustomized && currentDistrict && (
                          <div>
                            <Label className="text-sm font-medium text-foreground">
                              Tour Spots{' '}
                              <span className="text-muted-foreground font-normal">
                                ({selectedTourSpots.length} selected)
                              </span>
                            </Label>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {currentDistrict.tourSpots.map((spot) => (
                                <label
                                  key={spot.name}
                                  className={cn(
                                    'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                                    selectedTourSpots.includes(spot.name)
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border bg-card hover:bg-accent/50',
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedTourSpots.includes(spot.name)}
                                    onChange={() => toggleTourSpot(spot.name)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                                  />
                                  <span className="text-sm text-foreground">
                                    {spot.name}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Travel Dates */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Travel Dates
                    </label>
                    <DateRangePicker
                      aria-label="Travel date range"
                      shouldCloseOnSelect={false}
                      value={dateRange}
                      onChange={setDateRange}
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canNext}
                    className="w-full"
                  >
                    Next Step
                    <ArrowRightIcon />
                  </Button>
                </motion.div>
              )}

              {/* ── Step 2: Preferences (placeholder) ── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p>Step 2 — Preferences</p>
                    <p className="mt-1">Coming soon...</p>
                  </div>

                  <Button type="button" onClick={handleNext} className="w-full">
                    Next Step
                    <ArrowRightIcon />
                  </Button>
                </motion.div>
              )}

              {/* ── Step 3: Review (placeholder) ── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Review summary */}
                  <div className="bg-muted border border-border p-4 rounded-md">
                    <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                      <CheckSvg />
                      Review Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground">Destination:</span>
                        <span className="text-foreground font-medium">
                          {destination === 'bangladesh-customized'
                            ? 'Bangladesh (Customized)'
                            : destinationGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.category }))).find((i) => i.value === destination)?.name ?? '—'}
                        </span>
                      </div>
                      {isBangladeshDestination(destination) && selectedDivision && (
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">Division:</span>
                          <span className="text-foreground font-medium">{selectedDivision}</span>
                        </div>
                      )}
                      {isBangladeshDestination(destination) && !isCustomized && selectedDistrict && (
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">District:</span>
                          <span className="text-foreground font-medium">{selectedDistrict}</span>
                        </div>
                      )}
                      {isBangladeshDestination(destination) && isCustomized && selectedDistricts.length > 0 && (
                        <div className="py-1">
                          <span className="text-muted-foreground">Districts:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {selectedDistricts.map((district) => (
                              <span
                                key={district}
                                className="inline-block rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium"
                              >
                                {district}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {isBangladeshDestination(destination) && isCustomized && customizedTourSpots.length > 0 && (
                        <div className="py-1">
                          <span className="text-muted-foreground">Tour Spots:</span>
                          <div className="mt-1.5 space-y-1.5">
                            {customizedTourSpots.map((group) => (
                              <div key={group.district}>
                                <span className="text-xs font-semibold text-foreground/70">{group.district}</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {group.tourSpots.map((spot) => (
                                    <span
                                      key={spot.name}
                                      className="inline-block rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium"
                                    >
                                      {spot.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {isBangladeshDestination(destination) && !isCustomized && selectedTourSpots.length > 0 && (
                        <div className="py-1">
                          <span className="text-muted-foreground">Tour Spots:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {selectedTourSpots.map((spot) => (
                              <span
                                key={spot}
                                className="inline-block rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium"
                              >
                                {spot}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground">From:</span>
                        <span className="text-foreground font-medium">
                          {formatDateDisplay(fromMonth, fromDay, fromYear)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground">To:</span>
                        <span className="text-foreground font-medium">
                          {formatDateDisplay(effectiveToMonth, effectiveToDay, effectiveToYear)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </div>
                    ) : (
                      'Submit Package'
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Back Button */}
          {step > 1 && !embedded && (
            <button
              type="button"
              onClick={handleBack}
              className="mt-4 w-full text-muted-foreground hover:text-foreground transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <ArrowLeftIcon />
              Back to previous step
            </button>
          )}
          </motion.div>
        </div>

        {!embedded && (
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <PackageSummary
                destination={destinationGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.category }))).find((i) => i.value === destination)?.name ?? null}
                travelDate={travelDateDisplay}
                numTravelers={1}
                accommodationType=""
                transportType=""
                budget={0}
                activities={[]}
                specialRequests=""
                currencyCode={geo.currency}
                locale={geo.locale}
                timezone={geo.timezone}
              />
            </div>
          </div>
        )}      </div>
    </div>
  );
}
