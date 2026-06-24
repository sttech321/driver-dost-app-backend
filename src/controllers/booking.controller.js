import { asyncHandler } from '../utils/asyncHandler.js';
import * as bookingService from '../services/booking.service.js';

export const createOneWay = asyncHandler(async (req, res) => {
  const booking = await bookingService.createOneWayBooking(req.user.id, req.body);
  res.status(201).json({ success: true, data: booking });
});

export const createHourly = asyncHandler(async (req, res) => {
  const booking = await bookingService.createHourlyBooking(req.user.id, req.body);
  res.status(201).json({ success: true, data: booking });
});

export const createOutstation = asyncHandler(async (req, res) => {
  const booking = await bookingService.createOutstationBooking(req.user.id, req.body);
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
  res.json({ success: true, data: booking });
});

export const payBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.payBooking(
    req.user.id,
    req.params.id,
    req.body.paymentMethod
  );
  res.json({ success: true, data: booking });
});
