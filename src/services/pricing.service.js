// Central pricing rules so amounts are computed consistently, never hard-coded
// in controllers. Tune these tariffs in one place.
export const TARIFFS = {
  ONE_WAY: { base: 80, perKm: 10 }, // e.g. 7km => 80 + 70 = 150
  HOURLY: { perHour: 120 },
  OUTSTATION: {
    ROUND_TRIP: 1200,
    ONE_WAY: 1700,
  },
};

export function priceOneWay(distanceKm = 0) {
  const { base, perKm } = TARIFFS.ONE_WAY;
  return Math.round(base + perKm * distanceKm);
}

export function priceHourly(hours = 0) {
  return Math.round(TARIFFS.HOURLY.perHour * hours);
}

export function priceOutstation(tripType) {
  return TARIFFS.OUTSTATION[tripType] ?? TARIFFS.OUTSTATION.ROUND_TRIP;
}

// Haversine distance in km between two lat/lng points.
export function distanceKmBetween(a, b) {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
