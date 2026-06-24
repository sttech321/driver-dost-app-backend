// Geocoding proxy over free OpenStreetMap-based providers (no API key needed).
// Default provider: Photon (komoot) — purpose-built for typeahead autocomplete.
// Alternative: Nominatim. Pick via GEOCODER_PROVIDER env.
//
// We proxy through the backend so we can: set a proper User-Agent (required by
// Nominatim), bias results by location, and cache to be polite to upstream.
import { env } from '../config/env.js';

const PROVIDER = (process.env.GEOCODER_PROVIDER || 'photon').toLowerCase();
const USER_AGENT = 'DriverDost/1.0 (https://github.com/sttech321/driver-dost-app)';

// ── tiny in-memory TTL cache ────────────────────────────
const cache = new Map(); // key -> { value, expires }
const TTL_MS = 10 * 60 * 1000;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(key, value) {
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
}

async function fetchJson(url, timeoutMs = 5000) {
  // Node's global fetch has no end-to-end timeout; free OSM providers can hang.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Geocoder timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── label/address formatting shared by both providers ───
function buildPlace({ name, parts, lat, lng, id }) {
  const seen = new Set();
  const cleanParts = parts
    .filter(Boolean)
    .filter((p) => {
      const k = String(p).toLowerCase();
      if (k === String(name || '').toLowerCase() || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return {
    id: id != null ? String(id) : `${lat},${lng}`,
    label: name || cleanParts[0] || 'Unknown place',
    address: cleanParts.join(', '),
    lat,
    lng,
  };
}

// ── Photon ──────────────────────────────────────────────
function photonFeatureToPlace(f) {
  const p = f.properties || {};
  const [lng, lat] = f.geometry?.coordinates || [];
  const name = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city;
  return buildPlace({
    name,
    parts: [p.housenumber, p.street, p.district, p.city, p.county, p.state, p.postcode, p.country],
    lat,
    lng,
    id: p.osm_id,
  });
}

async function photonSearch(q, { lat, lng, limit }) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
  }
  const data = await fetchJson(url.toString());
  return (data.features || []).map(photonFeatureToPlace).filter((p) => p.lat != null);
}

async function photonReverse(lat, lng) {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
  const data = await fetchJson(url);
  const f = (data.features || [])[0];
  return f ? photonFeatureToPlace(f) : null;
}

// ── Nominatim ───────────────────────────────────────────
function nominatimToPlace(item) {
  const a = item.address || {};
  const name =
    a.amenity || a.building || a.road || a.suburb || a.city || a.town || a.village ||
    (item.display_name || '').split(',')[0];
  return buildPlace({
    name,
    parts: [a.road, a.suburb, a.city || a.town || a.village, a.county, a.state, a.postcode, a.country],
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    id: item.osm_id,
  });
}

async function nominatimSearch(q, { lat, lng, limit }) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(limit));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    // Bias toward a viewbox around the user.
    const d = 0.5;
    url.searchParams.set('viewbox', `${lng - d},${lat - d},${lng + d},${lat + d}`);
  }
  const data = await fetchJson(url.toString());
  return (data || []).map(nominatimToPlace);
}

async function nominatimReverse(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`;
  const item = await fetchJson(url);
  return item && item.lat ? nominatimToPlace(item) : null;
}

// ── public API ──────────────────────────────────────────
export async function searchPlaces(query, { lat, lng, limit = 6 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const key = `s:${PROVIDER}:${q}:${lat ?? ''}:${lng ?? ''}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const fn = PROVIDER === 'nominatim' ? nominatimSearch : photonSearch;
  const result = await fn(q, { lat, lng, limit });
  cacheSet(key, result);
  return result;
}

export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const rLat = Math.round(lat * 1e5) / 1e5;
  const rLng = Math.round(lng * 1e5) / 1e5;
  const key = `r:${PROVIDER}:${rLat}:${rLng}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const fn = PROVIDER === 'nominatim' ? nominatimReverse : photonReverse;
  const result = await fn(rLat, rLng);
  cacheSet(key, result);
  return result;
}
