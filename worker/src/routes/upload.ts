import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { publicImageUrl } from '../lib/r2';
import { createSupabaseAdminClient } from '../lib/supabase';
import { Env } from '../types';
import { z } from 'zod';

const upload = new Hono();

/**
 * R2 only returns an object's metadata from `list()` when it is explicitly
 * requested, so `httpMetadata` was always missing and every file looked like a
 * binary blob. The pinned @cloudflare/workers-types release does not type the
 * `include` option yet, so it is widened here instead of at every call site.
 */
function listWithMetadata(options: {
  prefix?: string;
  cursor?: string;
  limit?: number;
  include?: ('httpMetadata' | 'customMetadata')[];
}): Parameters<R2Bucket['list']>[0] {
  return options as Parameters<R2Bucket['list']>[0];
}

// Allowed image types and max size
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Upload image to R2 (admin only)
upload.post('/image', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;

  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const contentType = c.req.header('content-type') || '';

  // Handle multipart form data
  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, AVIF' }, 400);
    }

    if (file.size > MAX_SIZE) {
      return c.json({ error: 'File too large. Maximum size: 5MB' }, 400);
    }

    // Generate unique filename: deals/{slug}/{timestamp}-{random}.{ext}
    // If no slug is provided, files go under deals/ root (legacy).
    const ext = file.name.split('.').pop() || 'jpg';
    const random = Math.random().toString(36).substring(2, 8);
    const slug = (formData.get('slug') as string | null || '').trim();
    const folder = slug ? `deals/${slug}` : 'deals';
    const key = `${folder}/${Date.now()}-${random}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    await env.BLACKPEARL_BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    // Return the URL served through this Worker, on the host the admin used.
    const publicUrl = publicImageUrl(c.req.url, key);

    return c.json({ url: publicUrl, key });
  }

  return c.json({ error: 'Unsupported content type. Use multipart/form-data.' }, 400);
});

// Serve image from R2 (public)
// NOTE: Hono does NOT support Express-style multi-segment params like "/:key+";
// that pattern only ever matched a single segment, so nested keys such as
// "deals/1694…-abc123.webp" returned 404. Use a wildcard and parse the key
// from the request path instead.
function imageKeyFromPath(path: string): string {
  const match = path.match(/^\/upload\/image\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : '';
}

upload.get('/image/*', async (c) => {
  const env = c.env as Env;
  const key = imageKeyFromPath(new URL(c.req.url).pathname);

  if (!key) {
    return c.json({ error: 'Image key required' }, 400);
  }

  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const object = await env.BLACKPEARL_BUCKET.get(key);

  if (!object) {
    return c.json({ error: 'Image not found' }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});

// Storage stats for the admin dashboard (admin only)
// Lists all objects to compute total size, file count, and folder breakdown.
upload.get('/stats', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;

  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  let totalFiles = 0;
  let totalSize = 0;
  const folderBreakdown: Record<string, { count: number; size: number }> = {};
  let cursor: string | undefined = undefined;

  // Paginate through all objects
  while (true) {
    const page = await env.BLACKPEARL_BUCKET.list({ cursor, limit: 1000 });
    const objects: R2Object[] = page.objects || [];
    for (const obj of objects) {
      totalFiles++;
      totalSize += obj.size;
      // Top-level folder (e.g. "deals" from "deals/foo/bar.jpg")
      const parts = obj.key.split('/');
      const folder = parts.length > 1 ? parts[0] : '(root)';
      if (!folderBreakdown[folder]) {
        folderBreakdown[folder] = { count: 0, size: 0 };
      }
      folderBreakdown[folder].count++;
      folderBreakdown[folder].size += obj.size;
    }
    if (page.truncated && page.cursor) {
      cursor = page.cursor;
    } else {
      break;
    }
  }

  return c.json({
    totalFiles,
    totalSize,
    folders: folderBreakdown,
  });
});

// Batch delete multiple R2 objects (admin only)
upload.post('/batch-delete', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const body = await c.req.json<{ keys: string[] }>();
  const keys = body.keys;
  if (!Array.isArray(keys) || keys.length === 0) {
    return c.json({ error: 'keys array is required' }, 400);
  }
  if (keys.length > 100) {
    return c.json({ error: 'Maximum 100 files per batch' }, 400);
  }

  await env.BLACKPEARL_BUCKET.delete(keys);
  return c.json({ deleted: keys.length });
});

// Delete a whole folder — every object under a prefix — from R2 (admin only).
// R2 has no real directories, so "the folder deals/kuakata-sea" is the set of
// keys starting with that prefix; deleting the folder means deleting all of them.
upload.post('/delete-folder', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const body = await c.req.json<{ prefix: string }>();
  const raw = (body.prefix || '').trim().replace(/^\/+/, '');
  if (!raw) {
    return c.json({ error: 'prefix is required' }, 400);
  }

  const prefix = raw.endsWith('/') ? raw : `${raw}/`;

  // Without at least one slash this is a top-level name, and an empty prefix
  // would list — and then delete — the entire bucket.
  if (!prefix.includes('/') || prefix === '/') {
    return c.json({ error: 'Refusing to delete the bucket root' }, 400);
  }

  let deleted = 0;

  // Delete the first page, then list again from the start. Re-listing (rather
  // than following a cursor) matters because a cursor into a listing whose
  // objects have just been deleted can skip entries and leave the folder
  // half-empty.
  for (let pass = 0; pass < 10_000; pass++) {
    const page = await env.BLACKPEARL_BUCKET.list({ prefix, limit: 1000 });
    const keys = (page.objects || []).map((object) => object.key);
    if (keys.length === 0) {
      return c.json({ prefix, deleted });
    }
    await env.BLACKPEARL_BUCKET.delete(keys);
    deleted += keys.length;
  }

  return c.json({ error: 'Too many objects to delete in one call', deleted }, 500);
});

// Batch rename: add prefix/suffix to multiple R2 objects (admin only)
upload.post('/batch-rename', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const body = await c.req.json<{ keys: string[]; find: string; replace: string }>();
  const { keys, find, replace } = body;
  if (!Array.isArray(keys) || keys.length === 0) {
    return c.json({ error: 'keys array is required' }, 400);
  }
  if (keys.length > 100) {
    return c.json({ error: 'Maximum 100 files per batch' }, 400);
  }
  if (typeof find !== 'string') {
    return c.json({ error: 'find is required' }, 400);
  }

  let renamed = 0;
  let errors = 0;
  for (const oldKey of keys) {
    // Only rename the filename part (last segment), not folder paths
    const parts = oldKey.split('/');
    const filename = parts[parts.length - 1];
    const newFilename = filename.split(find).join(replace);
    if (newFilename === filename) {
      continue; // No change needed
    }
    parts[parts.length - 1] = newFilename;
    const newKey = parts.join('/');

    try {
      const existing = await env.BLACKPEARL_BUCKET.get(oldKey);
      if (!existing) { errors++; continue; }
      const conflict = await env.BLACKPEARL_BUCKET.head(newKey);
      if (conflict) { errors++; continue; }
      await env.BLACKPEARL_BUCKET.put(newKey, existing.body, {
        httpMetadata: existing.httpMetadata,
        customMetadata: existing.customMetadata,
      });
      await env.BLACKPEARL_BUCKET.delete(oldKey);
      renamed++;
    } catch {
      errors++;
    }
  }

  return c.json({ renamed, errors });
});

// List all objects in R2 bucket (admin only)
upload.get('/list', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;

  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const prefix = c.req.query('prefix') || '';
  const cursor = c.req.query('cursor') || undefined;
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

  const listed = await env.BLACKPEARL_BUCKET.list(listWithMetadata({
    prefix: prefix || undefined,
    cursor,
    limit,
    include: ['httpMetadata'],
  }));

  const files = (listed.objects || []).map((obj) => ({
    key: obj.key,
    size: obj.size,
    etag: obj.etag,
    httpEtag: obj.httpEtag,
    uploaded: obj.uploaded?.toISOString() || null,
    httpMetadata: {
      contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
      cacheControl: obj.httpMetadata?.cacheControl || null,
    },
  }));

  return c.json({
    files,
    truncated: listed.truncated,
    cursor: listed.truncated && listed.cursor ? listed.cursor : null,
  });
});

// Reorganize existing root-level deal images into deal-slug subfolders.
// For each deal, finds images it references that sit in the flat deals/ folder,
// moves them to deals/{slug}/, and updates all database references.
upload.post('/reorganize', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;

  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const adminClient = createSupabaseAdminClient(env);

  // Fetch all deals
  const { data: allDeals, error: dealsError } = await adminClient
    .from('tour_deals')
    .select('id, slug, image_url, gallery, itinerary, route_waypoints');

  if (dealsError) {
    return c.json({ error: 'Failed to fetch deals' }, 500);
  }

  const deals = allDeals || [];
  let moved = 0;
  let skipped = 0;
  let errors = 0;
  const details: string[] = [];

  for (const deal of deals) {
    if (!deal.slug) {
      skipped++;
      continue;
    }

    // Collect all image URLs from this deal
    const imageUrls: string[] = [];
    if (deal.image_url) imageUrls.push(deal.image_url);
    if (Array.isArray(deal.gallery)) {
      for (const url of deal.gallery) {
        if (typeof url === 'string' && !imageUrls.includes(url)) imageUrls.push(url);
      }
    }
    // Itinerary photos
    if (Array.isArray(deal.itinerary)) {
      for (const phase of deal.itinerary) {
        if (Array.isArray(phase.photos)) {
          for (const url of phase.photos) {
            if (typeof url === 'string' && !imageUrls.includes(url)) imageUrls.push(url);
          }
        }
      }
    }
    // Route waypoint images
    if (Array.isArray(deal.route_waypoints)) {
      for (const wp of deal.route_waypoints) {
        if (typeof wp.image === 'string' && !imageUrls.includes(wp.image)) imageUrls.push(wp.image);
      }
    }

    // For each image, check if it's in the root deals/ folder (not in a subfolder)
    for (const url of imageUrls) {
      const keyMatch = url.match(/\/upload\/image\/(.+)$/);
      if (!keyMatch) continue;

      const oldKey = decodeURIComponent(keyMatch[1]);
      // Skip if already in a subfolder (contains deals/X/ where X is not empty)
      const afterDeals = oldKey.replace(/^deals\//, '');
      if (afterDeals.includes('/')) continue; // Already in a subfolder

      // This file is in the root deals/ folder — move it
      const ext = oldKey.split('.').pop() || 'jpg';
      const filename = oldKey.split('/').pop() || oldKey;
      const newKey = `deals/${deal.slug}/${filename}`;

      try {
        const existing = await env.BLACKPEARL_BUCKET.get(oldKey);
        if (!existing) {
          skipped++;
          continue;
        }

        // Check destination doesn't already exist
        const conflict = await env.BLACKPEARL_BUCKET.head(newKey);
        if (!conflict) {
          // Copy to new location
          await env.BLACKPEARL_BUCKET.put(newKey, existing.body, {
            httpMetadata: existing.httpMetadata,
            customMetadata: existing.customMetadata,
          });
          // Delete original
          await env.BLACKPEARL_BUCKET.delete(oldKey);
        }

        // Build the new URL
        const newUrl = `/upload/image/${newKey}`;

        // Update database references for this deal
        const updates: Record<string, unknown> = {};
        if (deal.image_url === url) {
          updates.image_url = newUrl;
        }
        if (Array.isArray(deal.gallery)) {
          const idx = deal.gallery.indexOf(url);
          if (idx !== -1) {
            const newGallery = [...deal.gallery];
            newGallery[idx] = newUrl;
            updates.gallery = newGallery;
          }
        }
        if (Array.isArray(deal.itinerary)) {
          let changed = false;
          const newItinerary = deal.itinerary.map((phase: any) => {
            if (Array.isArray(phase.photos)) {
              const pIdx = phase.photos.indexOf(url);
              if (pIdx !== -1) {
                changed = true;
                const newPhotos = [...phase.photos];
                newPhotos[pIdx] = newUrl;
                return { ...phase, photos: newPhotos };
              }
            }
            return phase;
          });
          if (changed) updates.itinerary = newItinerary;
        }
        if (Array.isArray(deal.route_waypoints)) {
          let changed = false;
          const newWps = deal.route_waypoints.map((wp: any) => {
            if (wp.image === url) {
              changed = true;
              return { ...wp, image: newUrl };
            }
            return wp;
          });
          if (changed) updates.route_waypoints = newWps;
        }

        if (Object.keys(updates).length > 0) {
          await adminClient
            .from('tour_deals')
            .update(updates)
            .eq('id', deal.id);
        }

        moved++;
      } catch (err) {
        errors++;
        details.push(`Failed to move ${oldKey}: ${err}`);
      }
    }
  }

  return c.json({ moved, skipped, errors, details: details.slice(0, 20) });
});

// Rename/move an R2 object (admin only)
// Copies the object to a new key then deletes the original.
upload.patch('/rename', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  const body = await c.req.json();

  const schema = z.object({
    oldKey: z.string().min(1),
    newKey: z.string().min(1).regex(/^[a-zA-Z0-9._\-/]+$/),
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const { oldKey, newKey } = result.data;

  // Fetch the original object
  const existing = await env.BLACKPEARL_BUCKET.get(oldKey);
  if (!existing) {
    return c.json({ error: 'File not found' }, 404);
  }

  // Check if new key already exists
  const conflict = await env.BLACKPEARL_BUCKET.head(newKey);
  if (conflict) {
    return c.json({ error: 'A file with that name already exists' }, 409);
  }

  // Copy to new key
  await env.BLACKPEARL_BUCKET.put(newKey, existing.body, {
    httpMetadata: existing.httpMetadata,
    customMetadata: existing.customMetadata,
  });

  // Delete the original
  await env.BLACKPEARL_BUCKET.delete(oldKey);

  return c.json({
    message: 'File renamed',
    oldKey,
    newKey,
    url: publicImageUrl(c.req.url, newKey),
  });
});

// Delete image from R2 (admin only)
upload.delete('/image/*', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  const key = imageKeyFromPath(new URL(c.req.url).pathname);

  if (!key) {
    return c.json({ error: 'Image key required' }, 400);
  }

  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  await env.BLACKPEARL_BUCKET.delete(key);

  return c.json({ message: 'Image deleted' });
});

// List all media files for a deal slug folder (admin only)
// Returns files under deals/{slug}/ without requiring cursor-based listing.
upload.get('/by-slug/:slug', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  const slug = c.req.param('slug');

  if (!slug || !slug.trim()) {
    return c.json({ error: 'Slug is required' }, 400);
  }

  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const prefix = `deals/${slug.trim()}/`;
  const files: Array<{ key: string; url: string; size: number; contentType: string }> = [];
  let cursor: string | undefined = undefined;

  // Paginate through all objects under this slug prefix
  do {
    const page = await env.BLACKPEARL_BUCKET.list(listWithMetadata({ prefix, cursor, limit: 1000, include: ['httpMetadata'] }));
    for (const obj of page.objects || []) {
      files.push({
        key: obj.key,
        url: publicImageUrl(c.req.url, obj.key),
        size: obj.size,
        contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
      });
    }
    cursor = page.truncated && page.cursor ? page.cursor : undefined;
  } while (cursor);

  return c.json({ slug: slug.trim(), files, total: files.length });
});

// Check if a slug folder exists in R2 (public, no auth needed for validation)
upload.get('/slug-check/:slug', async (c) => {
  const env = c.env as Env;
  const slug = c.req.param('slug');

  if (!slug || !slug.trim()) {
    return c.json({ exists: false });
  }

  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ exists: false });
  }

  const prefix = `deals/${slug.trim()}/`;
  const page = await env.BLACKPEARL_BUCKET.list({ prefix, limit: 1 });
  const count = (page.objects || []).length;

  return c.json({ slug: slug.trim(), exists: count > 0, fileCount: count });
});

// List all existing deal slug folders in R2 (admin only)
upload.get('/slug-folders', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ folders: [] });
  }

  // List all objects under deals/ and extract unique first-level subfolder names
  const folderSet = new Set<string>();
  let cursor: string | undefined = undefined;

  do {
    const page = await env.BLACKPEARL_BUCKET.list({ prefix: 'deals/', cursor, limit: 1000 });
    for (const obj of page.objects || []) {
      const relative = obj.key.slice('deals/'.length); // e.g. "foo/123.jpg" or "123.jpg"
      const slashIdx = relative.indexOf('/');
      if (slashIdx > 0) {
        folderSet.add(relative.slice(0, slashIdx)); // e.g. "foo"
      }
    }
    cursor = page.truncated && page.cursor ? page.cursor : undefined;
  } while (cursor);

  return c.json({ folders: Array.from(folderSet).sort() });
});

// Create a slug folder in R2 by placing a .keep marker (admin only)
// This is a one-time action — the slug becomes permanent for the deal.
upload.post('/create-folder', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }

  const body = await c.req.json<{ slug: string }>();
  const slug = body.slug?.trim();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return c.json({ error: 'Invalid slug. Only lowercase letters, numbers, and hyphens allowed.' }, 400);
  }

  const folderKey = `deals/${slug}/.keep`;

  // Check if folder already has files (already created)
  const existing = await env.BLACKPEARL_BUCKET.head(folderKey);
  if (!existing) {
    // Also check if any files exist under this prefix (from prior uploads)
    const page = await env.BLACKPEARL_BUCKET.list({ prefix: `deals/${slug}/`, limit: 1 });
    if ((page.objects || []).length === 0) {
      // Truly empty — create the .keep marker
      await env.BLACKPEARL_BUCKET.put(folderKey, new Uint8Array(0), {
        httpMetadata: { contentType: 'application/x-empty' },
      });
    }
  }

  return c.json({ slug, created: true, key: folderKey });
});

export default upload;
