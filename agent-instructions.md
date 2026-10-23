# BlackPearl: Agent Instructions

> **Purpose:** This document instructs AI coding agents on how to maintain, extend, and build features for the BlackPearl full-stack tours & travel agency. It reflects the **actual deployed architecture** and all decisions made during development.

---

## 1. Project Overview

BlackPearl is a production-deployed tours & travel agency platform. Two roles: **Admin** and **Normal User**. Authentication is **Google OAuth only**. No email/password anywhere.

**Live URLs:**
- Frontend: `https://blackpearlbd.pages.dev`
- API: `https://blackpearl-api.ms-blackpearlbd.workers.dev`
- GitHub: `november-saiful/blackpearlbd` (push to `main` auto-deploys Pages)
- Supabase: `lichnzimdpnmofvigtfg`

**Core Modules:**
1. **Tour Deals**: Browse, search, filter, save, book. Works for guests and signed-in users.
2. **Build Your Own Package**: Cascading destination form, budget, preferences. Requires sign-in.
3. **User Profile**: Google-synced avatar, editable info, Pearls loyalty system, booking history, saved deals tab.
4. **Admin Panel**: Dashboard, users, deals, bookings, custom packages management.

---

## 2. Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Cloudflare     │     │   Cloudflare     │     │    Supabase     │
│     Pages       │◄────│    Workers       │◄────│   PostgreSQL    │
│  (React App)    │     │   (API/Edge)     │     │    + Auth       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                         │
   Mobile-first            Business Logic            DB, Auth, RLS
   React + Vite            Hono + Zod               Google OAuth
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + Tailwind CSS + shadcn/ui |
| **Routing** | React Router v6 with `React.lazy` code splitting |
| **State** | Zustand (client) + TanStack Query (server) |
| **Forms** | React Hook Form + Zod (all forms validated) |
| **PDF** | jsPDF + jspdf-autotable (client-side) |
| **API** | Cloudflare Workers + Hono |
| **Database** | Supabase PostgreSQL with RLS |
| **Auth** | Supabase Auth (Google OAuth only) |
| **Deploy** | Cloudflare Pages (auto from GitHub) + Workers |

---

## 3. Project Structure

```
blackpearl/
├── web/                          # Frontend (Cloudflare Pages)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/               # shadcn/ui (button, card, dialog, form, input, label, popover, select, skeleton, tabs, textarea, badge)
│   │   │   ├── layout/           # Navbar, Footer, Sidebar, RootLayout
│   │   │   ├── auth/             # GoogleSignIn, ProtectedRoute
│   │   │   ├── deals/            # DealCard, DealGrid, DealDetail, SaveDealButton
│   │   │   ├── package-builder/  # CascadingSelect, BudgetInput, TravelerForm, PackageSummary, PackageBuilderForm
│   │   │   ├── profile/          # ProfileCard, ProfileEditPopover, StatsCards, ToursSection, OthersSection, SavedDealsSection
│   │   │   ├── bookings/         # BookingCard, BookingModal, BookingStatusBadge, InvoiceGenerator
│   │   │   ├── admin/            # AdminStatsCards, UsersTable, DealsManager, BookingsManager, CustomPackagesManager
│   │   │   └── skeletons/        # DealCardSkeleton, ProfilePageSkeleton, AdminDashboardSkeleton
│   │   ├── hooks/                # useAuth, useProfile, useDeals, useBookings, useAdmin
│   │   ├── lib/                  # supabase.ts, api.ts, pdf-generator.ts, utils.ts, validators.ts
│   │   ├── stores/               # authStore.ts (Zustand)
│   │   ├── types/                # index.ts (all TypeScript interfaces)
│   │   ├── pages/                # Home, Deals, DealDetail, BuildPackage, Profile, NotFound, Admin/*
│   │   ├── router.tsx            # React.lazy route splitting
│   │   ├── App.tsx               # QueryClientProvider + RouterProvider + Toaster
│   │   ├── main.tsx              # Entry point
│   │   └── index.css             # Tailwind + CSS variables
│   ├── public/
│   │   └── blackpearl.svg        # Favicon + logo (black ship icon)
│   ├── vite.config.ts            # Manual chunks (vendor-react, vendor-ui, vendor-pdf, etc.)
│   ├── tailwind.config.js
│   └── package.json
├── worker/                       # API (Cloudflare Workers)
│   ├── src/
│   │   ├── index.ts              # Hono app entry
│   │   ├── middleware/            # auth.ts, admin.ts, cors.ts
│   │   ├── routes/               # auth, profile, deals, custom-packages, bookings, saved-deals, admin
│   │   ├── lib/                  # supabase.ts, pdf.ts, validators.ts
│   │   └── types/                # index.ts
│   ├── wrangler.toml
│   └── package.json
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── CLOUDFLARE_SETUP.md
├── README.md
└── .gitignore
```

---

## 4. Mobile-First Design Rules

**Every component must be built mobile-first.** This is the #1 UX priority.

### 4.1 Layout Rules
- **All page containers**: `px-4 sm:px-6 lg:px-8` for horizontal padding
- **Grid layouts**: Start with `grid-cols-1`, scale to `md:grid-cols-2` or `lg:grid-cols-3`
- **Flex layouts**: Use `flex-col` on mobile, `md:flex-row` on desktop
- **Sidebar (Admin)**: Hidden on mobile, use hamburger menu or bottom nav pattern
- **Navbar**: Full desktop nav hidden on mobile, hamburger menu with slide-down panel

### 4.2 Touch Targets
- All buttons and interactive elements: minimum `h-10` (40px) height
- Tap targets: minimum 44×44px (WCAG)
- Use `gap-2` or `gap-3` between tappable items to prevent mis-taps

### 4.3 Typography on Mobile
- Headings: `text-2xl sm:text-3xl` (scale up on larger screens)
- Body text: `text-sm sm:text-base`
- Prices: `text-xl sm:text-2xl font-bold`

### 4.4 Cards & Sections
- Deal cards: Stack vertically on mobile (`flex-col`), side-by-side on desktop (`sm:flex-row`)
- Profile card: Avatar centered on mobile, left-aligned on desktop
- Stats cards: `grid-cols-1 md:grid-cols-3`, full width on mobile
- Admin tables: Horizontal scroll on mobile with `overflow-x-auto`

### 4.5 Modals & Dialogs
- Use `sm:max-w-md` on Dialog components (full-width on mobile, constrained on desktop)
- Bottom sheet pattern on mobile: dialogs should feel like they slide up from bottom
- Form inputs: Full width, large touch targets

### 4.6 Navigation
- **Mobile Navbar**: Hamburger icon → slide-down panel with all links
- **Admin Sidebar**: Hidden on mobile, accessible via hamburger or back arrow
- **Tabs (Profile Tours, etc.)**: Scrollable horizontally on small screens

### 4.7 Skeleton Loading
- Every data-fetching page has a skeleton loading state (no spinners)
- Skeletons must match the exact layout of the loaded content
- Use `animate-pulse` on `bg-slate-200` rounded elements
- Component: `components/ui/skeleton.tsx` (base), `components/skeletons/*.tsx` (page-specific)

### 4.8 Images
- Deal images: `w-full h-48 object-cover` on cards, `w-full h-96 object-cover` on detail
- Profile avatar: `w-20 h-20 sm:w-24 sm:h-24 rounded-full`
- Always include `alt` text
- Use `loading="lazy"` on below-fold images

---

## 5. Key Behaviors

### 5.1 Authentication
- **Only Google OAuth**: no email/password fields anywhere
- Profile auto-creates on first login via database trigger
- Protected routes: `/profile` and `/admin/*` require auth
- Admin routes: `/admin/*` require `role === 'admin'`

### 5.2 Booking Flow (Works for Everyone)
- **"Book Now" button is available to ALL users**, no auth gate
- **Signed-in users**: Name, email, phone auto-filled from profile
- **Guest users**: Empty form asks for name, email, phone + guest notice
- On confirm: booking created (status: pending) → PDF invoice generated → auto-downloaded
- Guest notice: *"You're booking as a guest. Sign in next time to skip this step and track your bookings."*

### 5.3 Save/Bookmark Flow
- "Save" button (heart icon) on deal cards and detail page
- Requires auth: shows toast if not signed in
- Saved deals appear in Profile → "Saved Deals" card with Book Now + Remove buttons
- Toggle save/unsave with instant UI update via TanStack Query cache invalidation

### 5.4 Profile Page Layout (Mobile-First)
1. **Profile Card**: avatar, name, email (read-only), phone, address, edit button
2. **Stats Cards**: Total Tours, Pearls (with progress bar), Status tier
3. **My Tours**: Tabs: Upcoming / Current / Past (each with booking cards + invoice download)
4. **Others**: Pending, processing, rejected bookings
5. **Saved Deals**: Bookmarked deals with Book Now + Remove

### 5.5 Pearls Loyalty System
- 10 pearls awarded per approved booking (database trigger)
- Tiers: New (0) → Bronze (10) → Platinum (50) → Gold (100) → Diamond (200)
- Progress bar shows distance to next tier
- Tier badge colors: New: Gray, Bronze: #CD7F32, Platinum: #E5E4E2, Gold: #FFD700, Diamond: #B9F2FF

### 5.6 Admin Approval Flow
1. Admin sees pending booking in Admin Panel
2. Updates status to "Approved"
3. Database trigger awards 10 pearls + recalculates tier
4. Booking moves from "Others" to "Tours" in user profile

---

## 6. Form Validation (React Hook Form + Zod)

All forms use React Hook Form with Zod schemas. The `shadcn/ui` Form component wraps everything.

### Profile Edit Schema (`lib/validators.ts`)
```typescript
export const ProfileEditSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(/^[+]?[0-9\s-]{10,20}$/).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
});
```

### Package Builder Schema
```typescript
export const PackageBuilderSchema = z.object({
  destinationId: z.string().uuid('Please select a destination'),
  travelDate: z.string().min(1, 'Please select a travel date'),
  numTravelers: z.number().int().min(1).max(50),
  accommodationType: z.enum(['budget', 'standard', 'luxury']),
  transportType: z.enum(['flight', 'bus', 'train', 'self']),
  budget: z.number().positive('Budget must be greater than zero'),
  activities: z.array(z.string()),
  specialRequests: z.string().max(2000).optional(),
});
```

### Pattern: Using Form Component
```tsx
<FormField
  control={control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Label</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## 7. Code Splitting & Performance

### Route-Level Splitting (`router.tsx`)
All pages use `React.lazy()` with a `<SuspenseWrapper>` showing a spinner:
```tsx
const Home = lazy(() => import('@/pages/Home'));
const Deals = lazy(() => import('@/pages/Deals'));
// ... etc
```

### Manual Vendor Chunks (`vite.config.ts`)
```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-data': ['@tanstack/react-query', 'zustand'],
  'vendor-ui': ['@radix-ui/*', 'class-variance-authority', 'clsx', 'tailwind-merge'],
  'vendor-icons': ['lucide-react'],
  'vendor-pdf': ['jspdf', 'jspdf-autotable', 'canvg'],
  'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
  'vendor-auth': ['@supabase/supabase-js'],
}
```

---

## 8. Deployment

### Cloudflare Pages (Frontend): Auto-deploy from GitHub
- **Repo**: `november-saiful/blackpearlbd`, branch: `main`
- **Root directory**: `web`
- **Build command**: `npm install && npm run build`
- **Output**: `dist`
- **Env vars** (plain_text, build-time): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `NODE_VERSION=18`

### Cloudflare Workers (API): Manual deploy
```bash
cd worker && npx wrangler deploy
```
Secrets (set via `wrangler secret put`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Supabase
- Project: `lichnzimdpnmofvigtfg`
- Migrations: `supabase db push`
- Google OAuth: Enabled in dashboard, Client ID `794599502781-...`
- Redirect URLs: `https://blackpearlbd.pages.dev`, `http://localhost:3000/auth/callback`

---

## 9. Database Schema Summary

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User profiles (auto-created on signup) | id, full_name, email, phone, address, avatar_url, pearls, status, role |
| `destinations` | Hierarchical destinations for cascading form | id, name, parent_id, type |
| `tour_deals` | Admin-managed tour packages | id, title, slug, price, destination, itinerary, is_featured |
| `custom_packages` | User-created custom trips | id, user_id, destination_id, budget, status |
| `bookings` | Unified bookings (deals + custom) | id, user_id, booking_type, deal_id/custom_package_id, status, total_amount |
| `saved_deals` | User bookmarks | id, user_id, deal_id |
| `pearls_history` | Loyalty points audit trail | id, user_id, amount, reason, booking_id |

**RLS enabled on all tables.** Users access own data; admins access all.

**Key trigger**: `award_pearls_on_approval()`: fires on booking status change to "approved", awards 10 pearls, recalculates tier.

---

## 10. Component Patterns

### Skeleton Loading Pattern
Every data-fetching page has a dedicated skeleton component in `components/skeletons/`:
```tsx
if (isLoading) return <DealsPageSkeleton />;
// ... actual content
```

### Booking Modal Pattern (Works for All Users)
```tsx
// Auto-fill for signed-in users
useEffect(() => {
  if (isOpen && isAuthenticated && profile) {
    setTravelerDetails({ name: profile.full_name, email: profile.email, phone: profile.phone });
  }
}, [isOpen, isAuthenticated, profile]);
```

### React Hook Form Pattern
```tsx
const form = useForm<SchemaType>({ resolver: zodResolver(Schema) });
const { control, handleSubmit, watch } = form;
// Use <Form {...form}> wrapper + <FormField> for each field
```

### API Pattern (TanStack Query)
```tsx
const { data, isLoading } = useQuery({ queryKey: ['key'], queryFn: () => api.endpoint() });
const mutation = useMutation({ mutationFn: ..., onSuccess: () => queryClient.invalidateQueries({ queryKey: ['key'] }) });
```

---

## 11. Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0F172A` (Deep Navy) | Navbar, headings, buttons |
| Secondary | `#14B8A6` (Ocean Teal) | Accents, links, progress bars |
| Success | `#10B981` (Emerald) | Approved status, inclusions |
| Warning | `#F59E0B` (Amber) | Pending status, alerts |
| Danger | `#F43F5E` (Rose) | Rejected status, exclusions |
| Background | `#F8FAFC` (Pearl White) | Page background |
| Skeleton | `bg-slate-200 animate-pulse` | Loading states |

**Logo/Favicon**: `public/blackpearl.svg` (black ship icon, `#080341`)

---

## 12. Extension Points

- **Email notifications**: Leave `sendEmail()` stub in Worker, add TODO comments at booking/status change
- **Payment integration**: `payment_status` field exists, currently always "pending"
- **Reviews/Ratings**: Not in scope
- **Real-time notifications**: Supabase Realtime available but not required

---

## 13. Testing Checklist

- [ ] Mobile: All pages render correctly on 375px width
- [ ] Mobile: Hamburger menu opens/closes properly
- [ ] Mobile: Modals are full-width with proper padding
- [ ] Mobile: Tables scroll horizontally
- [ ] Mobile: Touch targets are ≥44px
- [ ] Google OAuth sign-in works end-to-end
- [ ] Guest booking works without sign-in
- [ ] Signed-in booking auto-fills traveler details
- [ ] Profile edit saves with validation errors shown inline
- [ ] Package builder form validates all fields
- [ ] Skeleton loading shows on all data-fetching pages
- [ ] PDF invoice generates and downloads
- [ ] Pearls update on admin approval
- [ ] Saved deals toggle works and persists
- [ ] Admin panel accessible only to admin role
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Production build succeeds (`npm run build`)

---

*Last updated: August 2026 (reflects actual deployed state)*
