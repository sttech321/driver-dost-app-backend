import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

const reviewerSelect = { select: { id: true, name: true } };

/**
 * Submit (or update) the rider's review for a booking, then recompute the
 * driver's aggregate rating + count from all their reviews (fully dynamic).
 */
export async function submitReview(userId, bookingId, { rating, comment }) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.userId !== userId) throw ApiError.notFound('Booking not found');
  if (!booking.driverId) throw ApiError.badRequest('This booking has no driver to review');

  const review = await prisma.review.upsert({
    where: { bookingId },
    update: { rating, comment: comment ?? null },
    create: { bookingId, driverId: booking.driverId, userId, rating, comment: comment ?? null },
  });

  // Recompute the driver's rating from real reviews.
  const agg = await prisma.review.aggregate({
    where: { driverId: booking.driverId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const driver = await prisma.driver.update({
    where: { id: booking.driverId },
    data: {
      rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      ratingCount: agg._count._all,
    },
  });

  return { review, driver };
}

/** A driver's current rating + recent reviews (for the public profile). */
export async function getDriverReviews(driverId, limit = 50) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw ApiError.notFound('Driver not found');
  const reviews = await prisma.review.findMany({
    where: { driverId },
    include: { user: reviewerSelect },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return { driver, reviews };
}
