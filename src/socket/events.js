// Server-side emit helpers used by controllers after a REST action succeeds.
// All are null-safe (no-op if Socket.IO isn't initialised).
import { getIo } from './io.js';
import { userRoom, bookingRoom, DRIVERS } from './rooms.js';

export function emitNewRequest(booking) {
  if (!booking) return;
  getIo()?.to(DRIVERS).emit('request:new', booking);
}

export function emitRequestTaken(bookingId) {
  if (!bookingId) return;
  getIo()?.to(DRIVERS).emit('request:taken', { bookingId });
}

export function emitBookingAccepted(booking) {
  if (!booking?.userId) return;
  getIo()?.to(userRoom(booking.userId)).emit('booking:accepted', booking);
}

// Notify both the ride room and the rider's personal room of a status change.
export function emitBookingStatus(booking) {
  const io = getIo();
  if (!io || !booking) return;
  io.to(bookingRoom(booking.id)).emit('booking:status', booking);
  if (booking.userId) io.to(userRoom(booking.userId)).emit('booking:status', booking);
}

// Push a new in-app notification to a specific user's personal room.
export function emitNotification(userId, notification) {
  if (!userId || !notification) return;
  getIo()?.to(userRoom(userId)).emit('notification:new', notification);
}
