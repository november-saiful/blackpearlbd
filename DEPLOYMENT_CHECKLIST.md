# BlackPearl Deployment Checklist

Use this checklist for every production release. The commands below assume the repository root is `blackpearl/`.

## 0. Release preflight

- [ ] Confirm the release is on the `main` branch and the working tree contains no unrelated changes.
- [ ] Review migrations in `supabase/migrations/`; migrations are applied by `.github/workflows/deploy-migrations.yml` when changes reach `main`.
- [ ] Run the offline environment check:

  ```bash
  node scripts/validate-env.mjs --env-file web/.env.local --env-file worker/.dev.vars --production --require-geo
  ```

- [ ] Never put `SUPABASE_SERVICE_ROLE_KEY`, `GEOAPIFY_API_KEY`, or any other secret in a `VITE_*` variable.
- [ ] Confirm production values are not placeholders and all production URLs use HTTPS.
- [ ] Run the verification commands in section 7 before deployment.

## 1. Supabase project and database

- [ ] Confirm the target project ref is `lichnzimdpnmofvigtfg` (or update the workflow and this checklist together if the project changes).
- [ ] Confirm the production `SUPABASE_URL` and frontend `VITE_SUPABASE_URL` point to the same project.
- [ ] Confirm database migrations are ordered, reviewed, and safe to apply.
- [ ] Apply migrations through the approved CI workflow or an explicitly reviewed `supabase db push`.
- [ ] Verify RLS is enabled on every application table and policies cover user-owned and admin-owned operations.
- [ ] Verify the profile creation trigger and booking approval/pearls trigger still exist and behave correctly.
- [ ] Confirm the database backup/restore policy for the Supabase project.
- [ ] Review Auth settings after schema changes; do not disable refresh-token rotation in production.

## 2. Supabase Auth and Google OAuth

### Supabase dashboard

- [ ] Google provider is enabled under **Authentication → Providers → Google**.
- [ ] Google Client ID and Client Secret are configured in Supabase; secrets are not committed.
- [ ] **Site URL** is the canonical frontend origin, for example `https://blackpearlbd.pages.dev`.
- [ ] Add the exact callback URLs under **Authentication → URL Configuration → Redirect URLs**:
  - `https://blackpearlbd.pages.dev/auth/callback`
  - `http://localhost:3000/auth/callback` for local development
  - `http://127.0.0.1:3000/auth/callback` only if that host is used locally
  - Any approved custom frontend origin, if one exists
- [ ] Do not add wildcard redirect URLs in production.

### Google Cloud Console

- [ ] Add the Supabase OAuth callback URI shown by the Supabase dashboard to the Google OAuth client’s **Authorized redirect URIs**.
- [ ] Add local and production frontend origins to **Authorized JavaScript origins** where required.
- [ ] Confirm the OAuth consent screen is published/configured for the intended users.
- [ ] Test sign-in in an incognito window and verify the browser returns to `/auth/callback`, then `/`.

## 3. Cloudflare Worker API

- [ ] Worker project is `blackpearl-api` and deploys from `worker/`.
- [ ] Production deployment branch is `main`; if the Cloudflare dashboard still shows another branch, correct it before release.
- [ ] Required Worker secrets are present in the target environment:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEOAPIFY_API_KEY`
- [ ] Secrets were added with `wrangler secret put` or the Cloudflare dashboard and are not stored in `wrangler.toml`.
- [ ] `worker/wrangler.toml` declares the `BLACKPEARL_BUCKET` R2 binding.
- [ ] Deploy from `worker/` with the approved command:

  ```bash
  npm run typecheck
  npm test -- --run
  npm run deploy
  ```

- [ ] Confirm the API health response:

  ```bash
  curl -i https://<worker-host>/
  ```

- [ ] Confirm CORS preflight from the real frontend origin. The response must include `Access-Control-Allow-Origin`.
- [ ] Confirm `/geo/cache-stats` is reachable and does not expose credentials or cached content.
- [ ] If using a custom API domain, confirm DNS, TLS, and the Pages `VITE_API_URL` value all point to the same canonical host.

## 4. Cloudflare R2

- [ ] Bucket `blackpearl-assets` exists in the intended Cloudflare account.
- [ ] The Worker binding name is exactly `BLACKPEARL_BUCKET`.
- [ ] Upload an image through the admin UI and verify:
  - the response returns a Worker-served URL;
  - the object appears under `deals/<slug>/`;
  - content type and immutable cache headers are present;
  - the public image URL loads without exposing bucket credentials.
- [ ] Verify an admin can list and delete media, while an unauthenticated request cannot access admin media endpoints.
- [ ] Verify existing image URLs still work after any custom API domain change; keep the `workers.dev` host enabled if legacy URLs depend on it.
- [ ] Confirm the bucket has an appropriate retention/backup policy before bulk delete or reorganization operations.

## 5. Cloudflare Pages frontend

- [ ] Pages project root directory is `web/`.
- [ ] Production branch is `main`.
- [ ] Build command is `npm install && npm run build`.
- [ ] Build output directory is `dist`.
- [ ] `NODE_VERSION=18` (or the tested Node version) is configured.
- [ ] Production build variables are set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_API_URL`
- [ ] No Worker-only secret appears in Pages variables.
- [ ] SPA fallback serves the app for `/auth/callback`, `/deals/<slug>`, `/profile`, and `/admin`.
- [ ] Confirm the deployed frontend URL is included in Supabase and Google OAuth allowlists.

## 6. Optional live validation

Run after Pages and Worker are deployed. This makes network requests but does not print secret values:

```bash
node scripts/validate-env.mjs \
  --env-file web/.env.production \
  --env-file worker/.dev.vars \
  --production --require-geo --live \
  --frontend-url https://blackpearlbd.pages.dev
```

For the authenticated R2 probe, provide a short-lived admin access token explicitly and do not save it in a file or CI log:

```bash
node scripts/validate-env.mjs \
  --env-file web/.env.production \
  --env-file worker/.dev.vars \
  --production --require-geo --live \
  --frontend-url https://blackpearlbd.pages.dev \
  --access-token "$BLACKPEARL_ADMIN_ACCESS_TOKEN"
```

The validator checks Worker health, CORS, Supabase Auth settings, the frontend root and callback route, and optionally the authenticated R2/media endpoint. OAuth redirect allowlists still require the dashboard checks above.

## 7. Required automated verification

From `web/`:

```bash
npm run typecheck
npm test -- --run
npm run build
```

From `worker/`:

```bash
npm run typecheck
npm test -- --run
```

From the repository root:

```bash
node --test scripts/validate-env.test.mjs
```

## 8. Post-deploy smoke test

- [ ] Open the production frontend in a clean/incognito browser session.
- [ ] Browse deals and open a deal detail page directly by URL.
- [ ] Complete a guest booking and confirm the invoice download.
- [ ] Sign in with Google and confirm the session survives a refresh.
- [ ] Confirm a signed-in booking auto-fills profile details.
- [ ] Confirm profile, saved deals, and booking history load.
- [ ] Confirm a non-admin user cannot access `/admin` or admin APIs.
- [ ] Confirm an admin can create/edit a deal, upload media, and review a booking.
- [ ] Approve a booking and verify Pearls/tier changes only once.
- [ ] Verify mobile navigation, dialogs, route maps, and the OAuth callback at 375px width.
- [ ] Check Worker logs, Pages deployment logs, Supabase Auth logs, and R2 object activity for errors.

## 9. Rollback and incident response

- [ ] If the frontend is broken, roll Pages back to the last known-good deployment.
- [ ] If the Worker is broken, roll back to the previous Worker version; keep database migrations compatible with both versions when possible.
- [ ] Do not roll back a database migration by deleting production data. Prepare a forward fix or a reviewed compensating migration.
- [ ] If a secret may be exposed, rotate it immediately in the relevant provider and redeploy dependent services.
- [ ] If OAuth fails, restore the last known-good Site URL and exact redirect allowlist entries before changing application code.
- [ ] Record the incident, affected release, rollback action, and follow-up migration/configuration change.
