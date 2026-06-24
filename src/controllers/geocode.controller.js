import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as geocode from '../services/geocode.service.js';

// Parse to a finite, in-range coordinate or return undefined.
function parseLat(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= -90 && n <= 90 ? n : undefined;
}
function parseLng(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= -180 && n <= 180 ? n : undefined;
}

// GET /api/geocode/search?q=&lat=&lng=&limit=
export const search = asyncHandler(async (req, res) => {
  const { q, lat, lng, limit } = req.query;
  if (!q || String(q).trim().length < 2) {
    return res.json({ success: true, data: [] });
  }
  // Only forward bias coords when they parse to valid numbers (never NaN).
  const biasLat = lat != null ? parseLat(lat) : undefined;
  const biasLng = lng != null ? parseLng(lng) : undefined;
  const results = await geocode.searchPlaces(String(q), {
    lat: biasLat,
    lng: biasLng,
    limit: limit ? Math.min(Math.max(Number(limit) || 6, 1), 10) : 6,
  });
  res.json({ success: true, data: results });
});

// GET /api/geocode/reverse?lat=&lng=
export const reverse = asyncHandler(async (req, res) => {
  const lat = parseLat(req.query.lat);
  const lng = parseLng(req.query.lng);
  if (lat === undefined || lng === undefined) {
    throw ApiError.badRequest('Valid lat and lng are required');
  }
  const place = await geocode.reverseGeocode(lat, lng);
  res.json({ success: true, data: place });
});
