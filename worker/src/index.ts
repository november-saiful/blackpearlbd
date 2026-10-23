import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors';
import { affectsPublicContent, bumpContentVersion } from './lib/content-version';
import type { Env } from './types';
import auth from './routes/auth';
import profile from './routes/profile';
import deals from './routes/deals';
import customPackages from './routes/custom-packages';
import bookings from './routes/bookings';
import savedDeals from './routes/saved-deals';
import admin from './routes/admin';
import upload from './routes/upload';
import geo from './routes/geo';
import reviews from './routes/reviews';
import notifications from './routes/notifications';

const app = new Hono();

// Global middleware
app.use('*', corsMiddleware);

// Retire the edge-rendered pages whenever a write could change one.
//
// The Pages Function keys its cached HTML on a content version, so bumping that
// version is what makes an admin's edit show up in the page's <head>, its Open
// Graph tags and the sitemap at once, without the Pages side having to know
// which URLs exist. No KV namespace bound means no-op.
app.use('*', async (c, next) => {
  await next();
  if (!affectsPublicContent(c.req.method, c.req.path) || !c.res.ok) return;

  const bump = bumpContentVersion(c.env as Env);
  try {
    c.executionCtx.waitUntil(bump);
  } catch {
    // No execution context to hand it to: let the write finish on its own.
    void bump;
  }
});

// Health check
app.get('/', (c) => {
  return c.json({ name: 'BlackPearl API', version: '1.0.0', status: 'ok' });
});

// Routes
app.route('/auth', auth);
app.route('/profile', profile);
app.route('/deals', deals);
app.route('/custom-packages', customPackages);
app.route('/bookings', bookings);
app.route('/saved-deals', savedDeals);
app.route('/admin', admin);
app.route('/upload', upload);
app.route('/geo', geo);
app.route('/reviews', reviews);
app.route('/notifications', notifications);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
