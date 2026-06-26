import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import {
  priceOneWay,
  priceHourly,
  priceOutstation,
  distanceKmBetween,
} from './pricing.service.js';
import { isGatewayConfigured, createOrder, gatewayKeyId, verifySignature } from './payment.service.js';

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

const markPaid = (bookingId, paymentMethod, paymentRef) =>
  prisma.booking.update({
    where: { id: bookingId },
    data: { paymentMethod, paymentStatus: 'PAID', status: 'COMPLETED', paymentRef: paymentRef ?? null },
    include: bookingInclude,
  });

/**
 * Settle a booking's payment (Driver Leaving screen).
 *  - CASH   → recorded, driver collects.
 *  - WALLET → deducted from the user's in-app wallet (must have balance).
 *  - CARD/UPI → Razorpay order (if configured) the app then completes via
 *    checkout + verifyOnlinePayment; in dev (no keys) it's marked paid (mock).
 * Returns { booking } OR { needsCheckout, order, booking } for online.
 */
export async function payBooking(userId, bookingId, paymentMethod) {
  const booking = await getBooking(userId, bookingId);
  // Already settled — no-op (justPaid:false so the caller doesn't re-notify/emit).
  if (booking.paymentStatus === 'PAID') return { booking, justPaid: false };
  const amount = Number(booking.amount);

  if (paymentMethod === 'CASH') {
    return { booking: await markPaid(bookingId, 'CASH'), justPaid: true };
  }

  if (paymentMethod === 'WALLET') {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (Number(user.walletBalance) < amount) {
        throw ApiError.badRequest('Insufficient wallet balance. Please top up.');
      }
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: amount } },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: { paymentMethod: 'WALLET', paymentStatus: 'PAID', status: 'COMPLETED' },
        include: bookingInclude,
      });
    });
    return { booking: updated, justPaid: true };
  }

  // CREDIT_CARD / UPI → online gateway
  if (isGatewayConfigured()) {
    const order = await createOrder(amount, `booking_${bookingId.slice(0, 8)}`);
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentMethod, paymentStatus: 'PENDING', paymentOrderId: order.id },
      include: bookingInclude,
    });
    return {
      booking: updated,
      needsCheckout: true,
      order: { id: order.id, amount: order.amount, currency: order.currency, keyId: gatewayKeyId() },
    };
  }

  // Dev mock (no Razorpay keys configured).
  return { booking: await markPaid(bookingId, paymentMethod, 'DEV_MOCK'), mock: true, justPaid: true };
}

/** Verify a Razorpay checkout result and mark the booking paid (idempotent on replay). */
export async function verifyOnlinePayment(userId, bookingId, { orderId, paymentId, signature }) {
  const booking = await getBooking(userId, bookingId);
  // Already settled — a replayed verify (retry/double-tap) is a no-op, not a re-notify.
  if (booking.paymentStatus === 'PAID') return { booking, justPaid: false };
  if (!verifySignature(orderId, paymentId, signature)) {
    throw ApiError.badRequest('Payment verification failed');
  }
  if (booking.paymentOrderId && booking.paymentOrderId !== orderId) {
    throw ApiError.badRequest('Order mismatch');
  }
  return {
    booking: await markPaid(bookingId, booking.paymentMethod || 'CREDIT_CARD', paymentId),
    justPaid: true,
  };
}
