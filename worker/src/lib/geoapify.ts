/**
 * Geoapify adapter.
 *
 * Everything provider-specific lives here: request URLs, response parsing and
 * the mapping into the small shapes the app actually needs. Routes return those
 * app-owned shapes, so the frontend never talks to Geoapify and a provider swap
 * only touches this file.
 *
 * The API key stays server-side (GEOAPIFY_API_KEY secret), it is never sent to
 * the browser, so it cannot be scraped out of the JS bundle and abused.
 */

const GEOAPIFY_BASE = 'https://api.geoapify.com/v1';

/** A place search result, flattened for the app. */
export interface GeoPlace {
  id: string | null;
  name: string;
  address: string;
  lat: number;
  lon: number;
}

/** A driving route, flattened to a single polyline. */
export interface GeoRoute {
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  distance: number;
  time: number;
}

/** Raised when upstream answers with a non-2xx status. */
export class GeoapifyError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GeoapifyError';
    this.status = status;
  }
}

interface GeoapifyFeature {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
}

interface GeoapifyPayload {
  features?: GeoapifyFeature[];
  results?: Record<string, unknown>[];
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Geoapify answers GeoJSON (`features[]`) by default and `results[]` when
 * `format=json` is asked for. Both are handled so that a shape difference can
 * never be mistaken for "no places found", which is exactly what happened
 * when the browser parsed `results` without requesting that format.
 */
function eachPlace(payload: GeoapifyPayload | null) {
  const fromResults = payload?.results ?? [];
  const fromFeatures = (payload?.features ?? []).map(
    (feature) => (feature?.properties ?? {}) as Record<string, unknown>,
  );
  return [...fromResults, ...fromFeatures];
}

function toPlace(properties: Record<string, unknown>, geometry?: { coordinates?: unknown }): GeoPlace | null {
  const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const lat = asFiniteNumber(properties.lat) ?? asFiniteNumber(coordinates[1]);
  const lon = asFiniteNumber(properties.lon) ?? asFiniteNumber(coordinates[0]);
  if (lat === null || lon === null) return null;

  const name = asString(properties.name) || asString(properties.address_line1) || asString(properties.formatted);
  const address = asString(properties.formatted) || name;

  return {
    id: asString(properties.place_id) || null,
    name: name || address,
    address,
    lat,
    lon,
  };
}

/** Geoapify's error bodies are `{ statusCode, error, message }`. */
function errorMessage(body: unknown, status: number): string {
  const payload = body as { message?: unknown; error?: unknown } | null;
  const message = asString(payload?.message) || asString(payload?.error);
  return message ? `${message} (HTTP ${status})` : `Geoapify request failed (HTTP ${status})`;
}

async function requestGeoapify(path: string, params: Record<string, string>, apiKey: string): Promise<GeoapifyPayload> {
  const query = new URLSearchParams({ ...params, apiKey });
  let response: Response;

  try {
    response = await fetch(`${GEOAPIFY_BASE}${path}?${query.toString()}`);
  } catch (error) {
    throw new GeoapifyError(`Could not reach Geoapify: ${(error as Error).message}`, 502);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new GeoapifyError(errorMessage(body, response.status), response.status);
  }

  return (body ?? {}) as GeoapifyPayload;
}

/** Forward geocoding: free-text place lookup. */
export async function searchPlaces(query: string, limit: number, apiKey: string): Promise<GeoPlace[]> {
  const payload = await requestGeoapify(
    '/geocode/search',
    // format=json keeps the response compact: the default GeoJSON payload
    // repeats every place's name in every language.
    { text: query, limit: String(limit), format: 'json' },
    apiKey,
  );

  return eachPlace(payload)
    .map((properties) => toPlace(properties))
    .filter((place): place is GeoPlace => place !== null);
}

/** Reverse geocoding: the address nearest a coordinate. */
export async function reverseGeocode(lat: number, lon: number, apiKey: string): Promise<GeoPlace | null> {
  const payload = await requestGeoapify(
    '/geocode/reverse',
    { lat: String(lat), lon: String(lon), format: 'json' },
    apiKey,
  );

  const [first] = eachPlace(payload);
  return first ? toPlace(first) : null;
}

/** Flattens LineString/MultiLineString geometry into one polyline. */
function toLineString(geometry: unknown): GeoRoute['geometry'] {
  const candidate = geometry as { type?: unknown; coordinates?: unknown } | null;
  if (!candidate || !Array.isArray(candidate.coordinates)) return null;

  const rawPoints =
    candidate.type === 'MultiLineString'
      ? (candidate.coordinates as unknown[]).flat()
      : candidate.type === 'LineString'
        ? candidate.coordinates
        : [];

  const coordinates = (rawPoints as unknown[])
    .map((point) => {
      const pair = Array.isArray(point) ? point : [];
      const lng = asFiniteNumber(pair[0]);
      const lat = asFiniteNumber(pair[1]);
      return lng === null || lat === null ? null : ([lng, lat] as [number, number]);
    })
    .filter((point): point is [number, number] => point !== null);

  return coordinates.length > 1 ? { type: 'LineString', coordinates } : null;
}

/** Driving route between two or more points. */
export async function route(
  waypoints: { lat: number; lon: number }[],
  mode: string,
  apiKey: string,
): Promise<GeoRoute> {
  const waypointString = waypoints.map((point) => `${point.lat.toFixed(4)},${point.lon.toFixed(4)}`).join('|');

  const payload = await requestGeoapify('/routing', { waypoints: waypointString, mode }, apiKey);
  const [feature] = payload.features ?? [];
  const properties = (feature?.properties ?? {}) as Record<string, unknown>;

  return {
    geometry: toLineString(feature?.geometry),
    distance: asFiniteNumber(properties.distance) ?? 0,
    time: asFiniteNumber(properties.time) ?? 0,
  };
}
