import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getGeoCurrency, getGeoLocale } from '@/hooks/useGeoLocation';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number, currencyCode?: string, locale?: string) {
  const currency = currencyCode ?? getGeoCurrency();
  const loc = locale ?? getGeoLocale();
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getTierColor(status: string) {
  switch (status) {
    case 'diamond': return 'glass-chip text-foreground';
    case 'gold': return 'glass-chip border-amber-300/50 bg-amber-100/50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200';
    case 'platinum': return 'glass-chip border-slate-300/50 bg-slate-100/50 text-slate-800 dark:border-white/15 dark:bg-white/10 dark:text-slate-200';
    case 'bronze': return 'glass-chip border-orange-300/50 bg-orange-100/50 text-orange-800 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-200';
    default: return 'glass-chip text-muted-foreground';
  }
}

export function getTierProgress(pearls: number) {
  if (pearls >= 200) return { current: 'Diamond', next: null, progress: 100, needed: 0 };
  if (pearls >= 100) return { current: 'Gold', next: 'Diamond', progress: ((pearls - 100) / 100) * 100, needed: 200 - pearls };
  if (pearls >= 50) return { current: 'Platinum', next: 'Gold', progress: ((pearls - 50) / 50) * 100, needed: 100 - pearls };
  return { current: 'Bronze', next: 'Platinum', progress: Math.min((pearls / 50) * 100, 100), needed: 50 - pearls };
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'approved': return 'border-emerald-300/50 bg-emerald-100/50 text-emerald-800 backdrop-blur-md dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200';
    case 'pending': return 'border-amber-300/50 bg-amber-100/50 text-amber-800 backdrop-blur-md dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200';
    case 'processing': return 'border-blue-300/50 bg-blue-100/50 text-blue-800 backdrop-blur-md dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200';
    case 'rejected': return 'border-rose-300/50 bg-rose-100/50 text-rose-800 backdrop-blur-md dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200';
    case 'cancelled': return 'glass-chip text-muted-foreground';
    default: return 'glass-chip text-muted-foreground';
  }
}
