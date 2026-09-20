#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const FRONTEND_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_URL'];
const WORKER_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const PLACEHOLDER_RE = /^(?:your[-_].*|<.*>|change[-_ ]?me.*|replace[-_ ]?me.*|example(?:\.|$)|supabase[-_ ]?url|anon[-_ ]?key|service[-_ ]?role[-_ ]?key|geoapify[-_ ]?api[-_ ]?key)$/i;
const SECRET_KEY_RE = /(SERVICE_ROLE|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)/i;

function usage() {
  return `Usage: node scripts/validate-env.mjs [options]

Options:
  --env-file <path>       Load one or more KEY=VALUE files (repeatable)
  --production            Require HTTPS, real values, and production URLs
  --require-geo           Treat GEOAPIFY_API_KEY as required
  --live                  Probe configured Worker, Supabase, and frontend URLs
  --access-token <token>  Probe authenticated Worker/R2 endpoints (never printed)
  --frontend-url <url>    Override the frontend URL used by --live
  --worker-url <url>      Override the Worker URL used by --live
  --json                  Emit machine-readable JSON
  --help                  Show this help
`;
}

export function parseEnvText(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function loadEnvFiles(files, cwd = process.cwd()) {
  const values = {};
  for (const file of files) {
    const filename = path.resolve(cwd, file);
    const text = fs.readFileSync(filename, 'utf8');
    Object.assign(values, parseEnvText(text));
  }
  return values;
}

function isPlaceholder(value) {
  return !value || PLACEHOLDER_RE.test(value.trim());
}

function addIssue(result, level, code, message) {
  result[level].push({ code, message });
}

function normalizeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function checkRequired(result, env, key, label, { required = true } = {}) {
  const value = env[key];
  if (!value) {
    addIssue(result, required ? 'errors' : 'warnings', `missing_${key}`, `${label}: ${key} is missing.`);
    return null;
  }
  if (isPlaceholder(value)) {
    addIssue(result, required ? 'errors' : 'warnings', `placeholder_${key}`, `${label}: ${key} still contains a placeholder value.`);
  }
  return value;
}

function checkUrl(result, value, key, { production, allowPath = false, requireHttps = production } = {}) {
  if (!value || isPlaceholder(value)) return null;
  const parsed = normalizeUrl(value);
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
    addIssue(result, 'errors', `invalid_${key}`, `${key} must be a valid HTTP(S) URL.`);
    return null;
  }
  if (requireHttps && parsed.protocol !== 'https:') {
    addIssue(result, 'errors', `insecure_${key}`, `${key} must use HTTPS in production.`);
  }
  if (!allowPath && parsed.pathname !== '/' && parsed.pathname !== '') {
    addIssue(result, 'errors', `path_${key}`, `${key} must be an origin without a path.`);
  }
  if (parsed.search || parsed.hash) {
    addIssue(result, 'errors', `query_${key}`, `${key} must not contain a query string or hash.`);
  }
  return parsed;
}

function checkApiUrl(result, value, { production }) {
  const parsed = checkUrl(result, value, 'VITE_API_URL', { production });
  if (!parsed) return null;
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    addIssue(result, 'errors', 'api_path', 'VITE_API_URL must be the Worker origin, not a route such as /api.');
  }
  return parsed;
}

function checkSecretExposure(result, env) {
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_') && SECRET_KEY_RE.test(key)) {
      addIssue(result, 'errors', 'frontend_secret_exposure', `${key} must not be exposed to the frontend build.`);
    }
  }
  if (env.VITE_GEOAPIFY_API_KEY) {
    addIssue(result, 'errors', 'frontend_geoapify_exposure', 'VITE_GEOAPIFY_API_KEY must not exist; Geoapify belongs in Worker secrets.');
  }
}

export function validateEnvironment(input = {}) {
  const env = { ...(input.env || {}) };
  const production = Boolean(input.production);
  const requireGeo = Boolean(input.requireGeo || production);
  const result = { errors: [], warnings: [], checks: [] };
  const note = (code, message) => result.checks.push({ code, message });

  const frontendSupabaseUrl = checkRequired(result, env, 'VITE_SUPABASE_URL', 'Frontend');
  const frontendAnonKey = checkRequired(result, env, 'VITE_SUPABASE_ANON_KEY', 'Frontend');
  const apiUrl = checkRequired(result, env, 'VITE_API_URL', 'Frontend');
  const workerSupabaseUrl = checkRequired(result, env, 'SUPABASE_URL', 'Worker');
  checkRequired(result, env, 'SUPABASE_ANON_KEY', 'Worker');
  checkRequired(result, env, 'SUPABASE_SERVICE_ROLE_KEY', 'Worker');
  checkRequired(result, env, 'GEOAPIFY_API_KEY', 'Worker geo/admin features', { required: requireGeo });

  const frontendUrl = checkUrl(result, frontendSupabaseUrl, 'VITE_SUPABASE_URL', { production });
  const workerUrl = checkUrl(result, workerSupabaseUrl, 'SUPABASE_URL', { production });
  checkApiUrl(result, apiUrl, { production });
  checkSecretExposure(result, env);

  if (frontendUrl && workerUrl && frontendUrl.origin !== workerUrl.origin) {
    addIssue(result, 'errors', 'supabase_project_mismatch', 'VITE_SUPABASE_URL and SUPABASE_URL must point to the same Supabase project.');
  }
  if (frontendAnonKey && env.SUPABASE_ANON_KEY && frontendAnonKey !== env.SUPABASE_ANON_KEY) {
    addIssue(result, 'warnings', 'anon_key_mismatch', 'Frontend and Worker anon keys differ; confirm this is intentional before deployment.');
  }

  const wranglerPath = input.wranglerPath || path.resolve(input.cwd || process.cwd(), 'worker/wrangler.toml');
  if (fs.existsSync(wranglerPath)) {
    const wrangler = fs.readFileSync(wranglerPath, 'utf8');
    if (!/binding\s*=\s*["']BLACKPEARL_BUCKET["']/.test(wrangler)) {
      addIssue(result, 'errors', 'missing_r2_binding', 'worker/wrangler.toml does not declare the BLACKPEARL_BUCKET R2 binding.');
    } else {
      note('r2_binding', 'BLACKPEARL_BUCKET binding is declared in worker/wrangler.toml.');
    }
    if (!/bucket_name\s*=\s*["'][^"']+["']/.test(wrangler)) {
      addIssue(result, 'errors', 'missing_r2_bucket_name', 'worker/wrangler.toml does not declare an R2 bucket name.');
    }
  } else {
    addIssue(result, 'warnings', 'wrangler_config_missing', 'worker/wrangler.toml was not found; R2 binding could not be checked.');
  }

  if (production) {
    const api = normalizeUrl(apiUrl || '');
    if (api && /localhost|127\.0\.0\.1/.test(api.hostname)) {
      addIssue(result, 'errors', 'local_api_in_production', 'Production VITE_API_URL must not point to localhost.');
    }
    if (frontendUrl && /localhost|127\.0\.0\.1/.test(frontendUrl.hostname)) {
      addIssue(result, 'errors', 'local_supabase_in_production', 'Production Supabase URL must not point to localhost.');
    }
    note('oauth_manual', 'OAuth redirect allowlists still require manual verification in Supabase and Google Cloud Console.');
  } else {
    note('oauth_manual', 'Verify the local OAuth callback URL is allowlisted: http://localhost:3000/auth/callback (and 127.0.0.1 if used).');
  }

  result.ok = result.errors.length === 0;
  return result;
}

async function fetchProbe(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { ok: response.ok, status: response.status, headers: Object.fromEntries(response.headers.entries()) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runLiveProbes(input, result) {
  const env = input.env || {};
  const workerUrl = input.workerUrl || env.VITE_API_URL;
  const frontendUrl = input.frontendUrl;
  const token = input.accessToken;
  if (!workerUrl) {
    addIssue(result, 'errors', 'live_worker_missing', 'Live checks require VITE_API_URL or --worker-url.');
    return result;
  }

  const workerRoot = workerUrl.replace(/\/$/, '');
  const health = await fetchProbe(`${workerRoot}/`);
  if (!health.ok) addIssue(result, 'errors', 'worker_health_failed', `Worker health probe failed${health.status ? ` with HTTP ${health.status}` : `: ${health.error}`}.`);
  else result.checks.push({ code: 'worker_health', message: `Worker health responded with HTTP ${health.status}.` });

  const cors = await fetchProbe(`${workerRoot}/`, { method: 'OPTIONS', headers: { Origin: frontendUrl || 'https://example.invalid', 'Access-Control-Request-Method': 'GET' } });
  if (!cors.ok || !cors.headers['access-control-allow-origin']) {
    addIssue(result, 'errors', 'cors_probe_failed', 'Worker CORS preflight did not return a successful response with Access-Control-Allow-Origin.');
  } else {
    result.checks.push({ code: 'cors', message: `Worker CORS preflight responded with HTTP ${cors.status}.` });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (supabaseUrl && anonKey && !isPlaceholder(supabaseUrl) && !isPlaceholder(anonKey)) {
    const auth = await fetchProbe(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: anonKey } });
    if (!auth.ok) addIssue(result, 'errors', 'supabase_probe_failed', `Supabase auth probe failed${auth.status ? ` with HTTP ${auth.status}` : `: ${auth.error}`}.`);
    else result.checks.push({ code: 'supabase_auth', message: `Supabase auth settings responded with HTTP ${auth.status}.` });
  }

  if (frontendUrl) {
    for (const route of ['/', '/auth/callback']) {
      const page = await fetchProbe(`${frontendUrl.replace(/\/$/, '')}${route}`);
      if (!page.ok) addIssue(result, 'errors', `frontend_${route === '/' ? 'root' : 'callback'}_failed`, `Frontend ${route} probe failed${page.status ? ` with HTTP ${page.status}` : `: ${page.error}`}.`);
      else result.checks.push({ code: `frontend_${route}`, message: `Frontend ${route} responded with HTTP ${page.status}.` });
    }
  } else {
    result.checks.push({ code: 'frontend_skipped', message: 'Frontend probes skipped; pass --frontend-url to enable them.' });
  }

  if (token) {
    const media = await fetchProbe(`${workerRoot}/upload/stats`, { headers: { Authorization: `Bearer ${token}` } });
    if (!media.ok) addIssue(result, 'errors', 'r2_probe_failed', `Authenticated R2/media probe failed${media.status ? ` with HTTP ${media.status}` : `: ${media.error}`}.`);
    else result.checks.push({ code: 'r2_media', message: `Authenticated R2/media probe responded with HTTP ${media.status}.` });
  } else {
    result.checks.push({ code: 'r2_skipped', message: 'R2/media probe skipped; pass --access-token with an admin access token to enable it.' });
  }

  result.ok = result.errors.length === 0;
  return result;
}

function parseArgs(argv) {
  const options = { envFiles: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') options.help = true;
    else if (arg === '--production') options.production = true;
    else if (arg === '--require-geo') options.requireGeo = true;
    else if (arg === '--live') options.live = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--env-file') options.envFiles.push(argv[++index]);
    else if (arg === '--access-token') options.accessToken = argv[++index];
    else if (arg === '--frontend-url') options.frontendUrl = argv[++index];
    else if (arg === '--worker-url') options.workerUrl = argv[++index];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const check of result.checks) console.log(`✓ ${check.message}`);
  for (const warning of result.warnings) console.warn(`⚠ ${warning.message}`);
  for (const error of result.errors) console.error(`✗ ${error.message}`);
  console.log(result.ok ? '\nEnvironment validation passed.' : '\nEnvironment validation failed.');
}

export async function main(argv = process.argv.slice(2), io = {}) {
  const log = io.log || console.log;
  try {
    const options = parseArgs(argv);
    if (options.help) {
      log(usage());
      return 0;
    }
    const cwd = process.cwd();
    const fileValues = loadEnvFiles(options.envFiles, cwd);
    const env = { ...fileValues, ...process.env };
    const result = validateEnvironment({ ...options, env, cwd });
    if (options.live) await runLiveProbes({ ...options, env }, result);
    printResult(result, options.json);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = await main();
}
