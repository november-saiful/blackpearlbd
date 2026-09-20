import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnvText, runLiveProbes, validateEnvironment } from './validate-env.mjs';

const base = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.production-anon-key',
  VITE_API_URL: 'https://api.example.com',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.production-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.production-service-role-key',
  GEOAPIFY_API_KEY: 'geo-key',
};

test('parses dotenv text without exposing quotes', () => {
  assert.deepEqual(parseEnvText('# comment\nFOO="bar baz"\nexport BAZ=qux\n'), { FOO: 'bar baz', BAZ: 'qux' });
});

test('accepts a complete production environment', () => {
  const result = validateEnvironment({ env: base, production: true, requireGeo: true, wranglerPath: 'worker/wrangler.toml' });
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('rejects missing worker credentials', () => {
  const { SUPABASE_SERVICE_ROLE_KEY: _, ...env } = base;
  const result = validateEnvironment({ env, wranglerPath: 'worker/wrangler.toml' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === 'missing_SUPABASE_SERVICE_ROLE_KEY'));
});

test('rejects placeholders and insecure production URLs', () => {
  const result = validateEnvironment({
    env: { ...base, VITE_API_URL: 'http://localhost:8787', SUPABASE_SERVICE_ROLE_KEY: '<service-role-key>' },
    production: true,
    wranglerPath: 'worker/wrangler.toml',
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === 'insecure_VITE_API_URL'));
  assert.ok(result.errors.some((issue) => issue.code === 'placeholder_SUPABASE_SERVICE_ROLE_KEY'));
});

test('rejects a Supabase project mismatch', () => {
  const result = validateEnvironment({
    env: { ...base, SUPABASE_URL: 'https://another.supabase.co' },
    wranglerPath: 'worker/wrangler.toml',
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === 'supabase_project_mismatch'));
});

test('rejects frontend secret exposure and Geoapify browser keys', () => {
  const result = validateEnvironment({
    env: { ...base, VITE_SERVICE_ROLE_KEY: 'secret', VITE_GEOAPIFY_API_KEY: 'geo-key' },
    wranglerPath: 'worker/wrangler.toml',
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === 'frontend_secret_exposure'));
  assert.ok(result.errors.some((issue) => issue.code === 'frontend_geoapify_exposure'));
});

test('does not require Geoapify for a non-production public-only environment', () => {
  const { GEOAPIFY_API_KEY: _, ...env } = base;
  const result = validateEnvironment({ env, wranglerPath: 'worker/wrangler.toml' });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((issue) => issue.code === 'missing_GEOAPIFY_API_KEY'));
});

test('reports live probe failures without exposing credentials', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  try {
    const result = validateEnvironment({ env: base, wranglerPath: 'worker/wrangler.toml' });
    await runLiveProbes({ env: base, workerUrl: base.VITE_API_URL, frontendUrl: 'https://frontend.example' }, result);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((issue) => issue.code === 'worker_health_failed'));
    assert.ok(result.errors.some((issue) => issue.code === 'supabase_probe_failed'));
    assert.ok(!JSON.stringify(result).includes(base.SUPABASE_SERVICE_ROLE_KEY));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
