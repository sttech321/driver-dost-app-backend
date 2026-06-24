import { asyncHandler } from '../utils/asyncHandler.js';
import * as driverService from '../services/driver.service.js';
import { emitRequestTaken, emitBookingAccepted, emitBookingStatus } from '../socket/events.js';

// Endpoints for a logged-in DRIVER account (req.driver set by requireDriver).

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.driver });
});

export const listRequests = asyncHandler(async (_req, res) => {
  const requests = await driverService.listPendingRequests();
  res.json({ success: true, data: requests });
});

export const acceptRequest = asyncHandler(async (req, res) => {
  const booking = await driverService.acceptRequest(req.driver, req.params.id);
  emitRequestTaken(booking.id); // other drivers: drop it from their list
  emitBookingAccepted(booking); // rider: driver found
  res.json({ success: true, data: booking });
});

export const myBookings = asyncHandler(async (req, res) => {
  const bookings = await driverService.listDriverBookings(req.driver.id);
  res.json({ success: true, data: bookings });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const booking = await driverService.updateDriverBookingStatus(
    req.driver.id,
    req.params.id,
    req.body.status
  );
  emitBookingStatus(booking); // rider sees trip progress live
  res.json({ success: true, data: booking });
});
