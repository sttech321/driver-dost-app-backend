import { asyncHandler } from '../utils/asyncHandler.js';
import * as bookingService from '../services/booking.service.js';
import * as reviewService from '../services/review.service.js';
import { emitNewRequest, emitRequestTaken, emitBookingStatus } from '../socket/events.js';
import { notify } from '../services/notification.service.js';

const notifyPaid = (userId, booking) =>
  notify(userId, {
    type: 'PAYMENT_SUCCESS',
    title: 'Payment successful',
    body: `Rs ${Number(booking.amount).toFixed(2)} paid for your ride.`,
    data: { bookingId: booking.id },
  });

export const createOneWay = asyncHandler(async (req, res) => {
  const booking = await bookingService.createOneWayBooking(req.user.id, req.body);
  emitNewRequest(booking); // notify online drivers in real time
  res.status(201).json({ success: true, data: booking });
});

export const createHourly = asyncHandler(async (req, res) => {
  const booking = await bookingService.createHourlyBooking(req.user.id, req.body);
  emitNewRequest(booking);
  res.status(201).json({ success: true, data: booking });
});

export const createOutstation = asyncHandler(async (req, res) => {
  const booking = await bookingService.createOutstationBooking(req.user.id, req.body);
  emitNewRequest(booking);
  res.status(201).json({ success: true, data: booking });
});

export const listBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.listBookings(req.user.id);
  res.json({ success: true, data: bookings });
});

export const getBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBooking(req.user.id, req.params.id);
  res.json({ success: true, data: booking });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(req.user.id, req.params.id);
  emitRequestTaken(booking.id); // remove from drivers' open list
  emitBookingStatus(booking);
  res.json({ success: true, data: booking });
});

export const payBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.payBooking(req.user.id, req.params.id, req.body.paymentMethod);
  // Only on the transition to PAID (justPaid) — never on a repeat/already-paid call.
  if (result.justPaid) {
    emitBookingStatus(result.booking);
    notifyPaid(req.user.id, result.booking);
  }
  res.json({ success: true, data: result });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const result = await bookingService.verifyOnlinePayment(req.user.id, req.params.id, req.body);
  if (result.justPaid) {
    emitBookingStatus(result.booking);
    notifyPaid(req.user.id, result.booking);
  }
  res.json({ success: true, data: result });
});

export const reviewBooking = asyncHandler(async (req, res) => {
  const result = await reviewService.submitReview(req.user.id, req.params.id, req.body);
  res.json({ success: true, data: result });
});
