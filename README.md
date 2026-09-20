# BlackPearl - Tours & Travel Agency

A full-stack tours and travel agency web application built with React, Cloudflare Workers, and Supabase.

## Features

- **Google OAuth Authentication** - Secure sign-in with Google
- **Tour Deals** - Browse and book curated tour packages
- **Build Your Own Package** - Custom trip builder with cascading forms
- **User Profile** - Editable profile with Pearls loyalty system
- **Admin Panel** - Full dashboard for managing all data
- **PDF Invoice Generation** - Client-side invoice generation on booking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18+ with Vite, Tailwind CSS, shadcn/ui |
| State | Zustand + TanStack Query |
| Forms | React Hook Form + Zod |
| PDF | jsPDF + jspdf-autotable |
| API | Cloudflare Workers + Hono |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (Google OAuth) |

## Project Structure

```
blackpearl/
├── web/                    # React frontend
├── worker/                 # Cloudflare Worker API
├── scripts/                # Local release and validation tools
├── supabase/migrations/    # Ordered SQL migrations
├── DEPLOYMENT_CHECKLIST.md # Full production release checklist
└── README.md
```

## Local setup

Prerequisites: Node.js 18+, npm, a Supabase project, and a Cloudflare account for Worker/R2 deployment.

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars with local Supabase and Geoapify values
npm run dev
```

In another terminal:

```bash
cd web
npm install
cp .env.example .env.local
# Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_API_URL
npm run dev
```

Local OAuth callback: `http://localhost:3000/auth/callback`. Add the exact URL to Supabase Auth redirect URLs; add the Supabase provider callback URI to Google Cloud Console.

## Environment variables

### Frontend (`web/.env.local` or Cloudflare Pages)

These are build-time browser values and are public by design:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://your-worker.workers.dev
```

Never put `SUPABASE_SERVICE_ROLE_KEY` or `GEOAPIFY_API_KEY` in a `VITE_*` variable.

### Worker (`worker/.dev.vars` or Cloudflare Worker secrets)

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEOAPIFY_API_KEY=your-geoapify-api-key
```

The R2 bucket is bound as `BLACKPEARL_BUCKET` in `worker/wrangler.toml`. Geoapify is proxied through Worker `/geo` routes so its key never ships to the browser.

## Deployment

Read [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) before every release. It covers Cloudflare Pages, Workers, R2, Supabase migrations/RLS, Google OAuth, smoke tests, validation, and rollback.

Run the offline validator from the repository root:

```bash
node scripts/validate-env.mjs \
  --env-file web/.env.production \
  --env-file worker/.dev.vars \
  --production --require-geo
```

Run optional live probes after deployment:

```bash
node scripts/validate-env.mjs \
  --env-file web/.env.production \
  --env-file worker/.dev.vars \
  --production --require-geo --live \
  --frontend-url https://your-pages-domain.example
```

The live mode checks Worker health/CORS, Supabase Auth settings, frontend routes, and optionally R2/media with an explicitly supplied short-lived admin access token. It never prints secret values.

### Frontend (Cloudflare Pages)

- Root directory: `web`
- Branch: `main`
- Build command: `npm install && npm run build`
- Output directory: `dist`
- Set `NODE_VERSION=18` and the three `VITE_*` variables above.

### Worker (Cloudflare Workers)

```bash
cd worker
npm run typecheck
npm test -- --run
npm run deploy
```

Set Worker secrets with `wrangler secret put` or the Cloudflare dashboard. Keep `workers.dev` enabled if existing database image URLs use it. A custom API domain is recommended for canonical URLs and shared edge cache behavior.

### Database migrations

Migrations are deployed by `.github/workflows/deploy-migrations.yml` on pushes to `main` when `supabase/migrations/**` changes. The workflow requires the GitHub secret `SUPABASE_ACCESS_TOKEN` and targets the configured Supabase project ref.

## Verification

```bash
# Repository root
node --test scripts/validate-env.test.mjs

# Frontend
cd web && npm run typecheck && npm test -- --run && npm run build

# Worker
cd worker && npm run typecheck && npm test -- --run
```

## Pearls loyalty system

- Earn 10 pearls for each approved booking
- New: 0-9, Bronze: 10-49, Platinum: 50-99, Gold: 100-199, Diamond: 200+

## Admin features

- Dashboard with stats
- Manage users, deals, bookings, reviews, media, and custom packages
- Approve/reject bookings and manage package destinations

## License

MIT
