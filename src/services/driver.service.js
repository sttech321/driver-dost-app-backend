import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { distanceKmBetween } from './pricing.service.js';

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

/** Open ride requests a driver can accept (unassigned & still REQUESTED). */
export async function listPendingRequests() {
  return prisma.booking.findMany({
    where: { status: 'REQUESTED', driverId: null },
    include: { user: requesterSelect },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
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

export async function updateDriverBookingStatus(driverId, bookingId, status) {
  const { count } = await prisma.booking.updateMany({
    where: { id: bookingId, driverId },
    data: { status },
  });
  if (count === 0) throw ApiError.notFound('Booking not found');
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: requesterSelect, driver: true },
  });
}
