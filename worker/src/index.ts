import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors';
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

const app = new Hono();

// Global middleware
app.use('*', corsMiddleware);

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
