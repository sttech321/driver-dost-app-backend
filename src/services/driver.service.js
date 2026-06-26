import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { distanceKmBetween } from './pricing.service.js';

// How far a driver will travel to a pickup (and how far requests are shown).
export const REQUEST_RADIUS_KM = Number(process.env.REQUEST_RADIUS_KM || 8);

/** Recommended drivers near a point, sorted by rating then proximity. */
export async function getRecommendedDrivers({ lat, lng, limit = 10 }) {
  const drivers = await prisma.driver.findMany({
    where: { isAvailable: true, isVerified: true },
    orderBy: { rating: 'desc' },
    take: 50,
  });

  const withDistance = drivers.map((d) => ({
    ...d,
    distanceKm:
      lat && lng && d.lat && d.lng
        ? distanceKmBetween({ lat, lng }, { lat: d.lat, lng: d.lng })
        : null,
  }));

  withDistance.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    return Number(b.rating) - Number(a.rating);
  });

  return withDistance.slice(0, limit);
}

/** Pick the best available driver to auto-assign to a new booking. */
export async function assignDriver({ lat, lng } = {}) {
  const [driver] = await getRecommendedDrivers({ lat, lng, limit: 1 });
  return driver || null;
}

export async function getDriverById(id) {
  return prisma.driver.findUnique({ where: { id } });
}

// ───────── Driver portal (logged-in driver) ─────────

export async function getDriverByUserId(userId) {
  return prisma.driver.findUnique({ where: { userId } });
}

const requesterSelect = { select: { id: true, name: true, phone: true, photoUrl: true } };

/**
 * Open ride requests a driver can accept (unassigned & still REQUESTED).
 * When the driver's location is known, only requests whose pickup is within
 * REQUEST_RADIUS_KM are returned.
 */
export async function listPendingRequests({ lat, lng, radiusKm = REQUEST_RADIUS_KM } = {}) {
  const requests = await prisma.booking.findMany({
    where: { status: 'REQUESTED', driverId: null },
    include: { user: requesterSelect },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  if (lat == null || lng == null) return requests.slice(0, 50);

  const within = requests
    .map((b) => {
      const d =
        b.pickupLat != null && b.pickupLng != null
          ? distanceKmBetween({ lat, lng }, { lat: b.pickupLat, lng: b.pickupLng })
          : null;
      return { booking: b, dist: d };
    })
    // Keep requests within radius; keep coordinate-less ones too (can't filter).
    .filter((x) => x.dist == null || x.dist <= radiusKm)
    .sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9))
    .map((x) => x.booking);

  return within.slice(0, 50);
}

/** Count available drivers within radius of a point (for "drivers nearby"). */
export async function countAvailableDriversNear({ lat, lng, radiusKm = REQUEST_RADIUS_KM } = {}) {
  const drivers = await prisma.driver.findMany({
    where: { isAvailable: true, isVerified: true },
  });
  if (lat == null || lng == null) return drivers.length;
  return drivers.filter((d) => {
    if (d.lat == null || d.lng == null) return false;
    const dist = distanceKmBetween({ lat, lng }, { lat: d.lat, lng: d.lng });
    return dist != null && dist <= radiusKm;
  }).length;
}

/** Update a driver's last-known location (keeps "drivers nearby" fresh). */
export async function updateDriverLocation(driverId, lat, lng) {
  if (lat == null || lng == null) return;
  try {
    await prisma.driver.update({ where: { id: driverId }, data: { lat, lng } });
  } catch {
    /* non-critical */
  }
}

/** Atomically claim an open request for this driver. */
export async function acceptRequest(driver, bookingId) {
  // updateMany with the guard ensures we only claim a still-open booking
  // (prevents two drivers grabbing the same request).
  const { count } = await prisma.booking.updateMany({
    where: { id: bookingId, status: 'REQUESTED', driverId: null },
    data: { driverId: driver.id, status: 'ACCEPTED', etaMinutes: 2 },
  });
  if (count === 0) {
    const existing = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existing) throw ApiError.notFound('Request not found');
    throw ApiError.conflict('This request was already taken');
  }
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { driver: true, user: requesterSelect },
  });
}

/** All bookings assigned to this driver. */
export async function listDriverBookings(driverId) {
  return prisma.booking.findMany({
    where: { driverId },
    include: { user: requesterSelect, driver: true },
    orderBy: { createdAt: 'desc' },
  });
}

/** A single booking assigned to this driver (for the trip detail page). */
export async function getDriverBooking(driverId, bookingId) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, driverId },
    include: { user: requesterSelect, driver: true },
  });
  if (!booking) throw ApiError.notFound('Trip not found');
  return booking;
}

export async function updateDriverBookingStatus(driverId, bookingId, status) {
  // Only a real transition counts: owned, not already in this status, and not
  // already terminal (can't move out of COMPLETED/CANCELLED). This makes repeated
  // status calls idempotent so the rider isn't notified twice.
  const { count } = await prisma.booking.updateMany({
    where: { id: bookingId, driverId, status: { not: status, notIn: ['COMPLETED', 'CANCELLED'] } },
    data: { status },
  });
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, driverId },
    include: { user: requesterSelect, driver: true },
  });
  if (!booking) throw ApiError.notFound('Booking not found');
  return { booking, transitioned: count > 0 };
}
