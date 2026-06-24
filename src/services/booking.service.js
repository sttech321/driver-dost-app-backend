import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import {
  priceOneWay,
  priceHourly,
  priceOutstation,
  distanceKmBetween,
} from './pricing.service.js';

const bookingInclude = { driver: true };

/** ONE_WAY: pickup + destination, auto-assign nearest driver. */
export async function createOneWayBooking(userId, data) {
  const distanceKm =
    data.distanceKm ??
    distanceKmBetween(
      { lat: data.pickupLat, lng: data.pickupLng },
      { lat: data.destinationLat, lng: data.destinationLng }
    ) ??
    0;

  // Bookings start unassigned (REQUESTED); a driver accepts them.
  return prisma.booking.create({
    data: {
      userId,
      type: 'ONE_WAY',
      status: 'REQUESTED',
      pickupLabel: data.pickupLabel,
      pickupAddress: data.pickupAddress,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      destinationLabel: data.destinationLabel,
      destinationAddress: data.destinationAddress,
      destinationLat: data.destinationLat,
      destinationLng: data.destinationLng,
      scheduledAt: data.scheduledAt ?? null,
      distanceKm,
      etaMinutes: data.etaMinutes ?? 2,
      amount: priceOneWay(distanceKm),
    },
    include: bookingInclude,
  });
}

/** HOURLY: pickup + date + start/end hour range. */
export async function createHourlyBooking(userId, data) {
  const hours = Math.max(1, (data.endHour ?? 0) - (data.startHour ?? 0));

  return prisma.booking.create({
    data: {
      userId,
      type: 'HOURLY',
      status: 'REQUESTED',
      pickupLabel: data.pickupLabel,
      pickupAddress: data.pickupAddress,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      scheduledAt: data.scheduledAt ?? null,
      startHour: data.startHour,
      endHour: data.endHour,
      hours,
      amount: priceHourly(hours),
    },
    include: bookingInclude,
  });
}

/** OUTSTATION: pickup + destination + date + ROUND_TRIP|ONE_WAY tier. */
export async function createOutstationBooking(userId, data) {
  return prisma.booking.create({
    data: {
      userId,
      type: 'OUTSTATION',
      outstationType: data.outstationType,
      status: 'REQUESTED',
      pickupLabel: data.pickupLabel,
      pickupAddress: data.pickupAddress,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      destinationLabel: data.destinationLabel,
      destinationAddress: data.destinationAddress,
      destinationLat: data.destinationLat,
      destinationLng: data.destinationLng,
      scheduledAt: data.scheduledAt ?? null,
      amount: priceOutstation(data.outstationType),
    },
    include: bookingInclude,
  });
}

export async function getBooking(userId, bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });
  if (!booking || booking.userId !== userId) throw ApiError.notFound('Booking not found');
  return booking;
}

export async function listBookings(userId) {
  return prisma.booking.findMany({
    where: { userId },
    include: bookingInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function cancelBooking(userId, bookingId) {
  const booking = await getBooking(userId, bookingId);
  if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
    throw ApiError.badRequest(`Cannot cancel a ${booking.status.toLowerCase()} booking`);
  }
  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' },
    include: bookingInclude,
  });
}

export async function updateBookingStatus(userId, bookingId, status) {
  await getBooking(userId, bookingId);
  return prisma.booking.update({
    where: { id: bookingId },
    data: { status },
    include: bookingInclude,
  });
}

/** Driver Leaving screen — settle payment with a chosen method. */
export async function payBooking(userId, bookingId, paymentMethod) {
  const booking = await getBooking(userId, bookingId);
  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentMethod,
      paymentStatus: 'PAID',
      status: 'COMPLETED',
    },
    include: bookingInclude,
  });
}
