# Cloudflare and Supabase Deployment Setup

Use [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) for the complete release and rollback procedure. This file contains the dashboard-specific configuration.

## Cloudflare Pages

Configure the Pages project with:

| Setting | Value |
|---|---|
| Repository | `november-saiful/blackpearlbd` |
| Production branch | `main` |
| Root directory | `web` |
| Build command | `npm install && npm run build` |
| Build output directory | `dist` |
| Node.js | `NODE_VERSION=18` |

Set these production build variables in **Pages → Settings → Environment variables**:

```text
VITE_SUPABASE_URL=https://lichnzimdpnmofvigtfg.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_API_URL=https://<worker-host>
```

`VITE_SUPABASE_ANON_KEY` is a browser-safe public key. Do not add `SUPABASE_SERVICE_ROLE_KEY`, `GEOAPIFY_API_KEY`, or any other server secret to Pages variables.

Ensure the Pages deployment serves the SPA fallback for `/auth/callback`, `/deals/<slug>`, `/profile`, and `/admin`.

## Cloudflare Worker

Configure the Worker project with:

| Setting | Value |
|---|---|
| Worker name | `blackpearl-api` |
| Repository | `november-saiful/blackpearlbd` |
| Production branch | `main` |
| Root directory | `worker` |
| Config | `worker/wrangler.toml` |

The `wrangler.toml` file declares the R2 binding:

```toml
r2_buckets = [{ binding = "BLACKPEARL_BUCKET", bucket_name = "blackpearl-assets" }]
```

Set these as Worker secrets, not plain-text configuration:

```text
SUPABASE_URL=https://lichnzimdpnmofvigtfg.supabase.co
SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
GEOAPIFY_API_KEY=<geoapify-api-key>
```

CLI setup from `worker/`:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GEOAPIFY_API_KEY
npm run typecheck
npm test -- --run
npm run deploy
```

Never place real secret values in `wrangler.toml`, `.dev.vars.example`, source files, or Pages variables.

## R2

Create or select the `blackpearl-assets` bucket in the same Cloudflare account and confirm the Worker binding is exactly `BLACKPEARL_BUCKET`. After deploying, upload one image from the admin media UI and verify the returned Worker URL, content type, cache headers, and object key under `deals/<slug>/`.

Keep the `workers.dev` hostname enabled if existing database image URLs use it. If a custom domain is attached, new uploads use the host handling the upload, so update `VITE_API_URL` and retest legacy image URLs before treating the custom domain as canonical.

## Custom API domain (optional but recommended)

Attach a custom domain under **Workers & Pages → blackpearl-api → Settings → Domains & Routes → Add → Custom Domain**, for example `api.blackpearl.bd`. This requires DNS permissions and is best configured in the dashboard. If config-as-code is preferred, use the equivalent `routes` configuration only after the account has the required DNS scope.

After attaching it:

1. Set Pages `VITE_API_URL` to `https://api.blackpearl.bd` and redeploy Pages.
2. Check `https://api.blackpearl.bd/`.
3. Check `https://api.blackpearl.bd/geo/cache-stats`.
4. Run the validator with `--live`.

## Supabase Auth and Google OAuth

In **Supabase → Authentication → Providers → Google**:

1. Enable Google.
2. Add the Google Client ID and Client Secret.
3. Set **Site URL** to the canonical Pages origin, such as `https://blackpearlbd.pages.dev`.
4. Add exact redirect URLs under **Authentication → URL Configuration**:
   - `https://blackpearlbd.pages.dev/auth/callback`
   - `http://localhost:3000/auth/callback` for local development
   - `http://127.0.0.1:3000/auth/callback` only if local development uses that host
   - Any approved custom frontend origin
5. Do not use production wildcard redirect URLs.

In **Google Cloud Console → APIs & Services → Credentials**, update the OAuth client:

- Add the Supabase provider callback URI shown in the Supabase dashboard to **Authorized redirect URIs**.
- Add local and production frontend origins to **Authorized JavaScript origins** where required.
- Confirm the consent screen is configured for the intended audience.

The application callback route is `/auth/callback`; Supabase's provider callback URI is a separate URL and both must be configured.

## Supabase migrations

The GitHub workflow `.github/workflows/deploy-migrations.yml` runs on `main` when migration files change. Configure the repository secret `SUPABASE_ACCESS_TOKEN` and confirm the project ref in the workflow matches the production project.

For local validation:

```bash
supabase db reset
supabase db lint
```

For a production release, prefer the reviewed CI workflow or an explicitly approved `supabase db push`. Verify RLS, triggers, and backups after applying migrations.

## Validation

From the repository root:

```bash
node scripts/validate-env.mjs \
  --env-file web/.env.production \
  --env-file worker/.dev.vars \
  --production --require-geo --live \
  --frontend-url https://blackpearlbd.pages.dev
```

The validator checks required variables, URL safety, Supabase project alignment, accidental frontend secret exposure, the R2 binding, Worker health/CORS, Supabase Auth, frontend routes, and optionally authenticated R2 access. It never prints secret values. OAuth allowlists remain a required manual dashboard check.
