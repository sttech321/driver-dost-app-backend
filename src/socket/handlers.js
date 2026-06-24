import { prisma } from '../config/prisma.js';
import { userRoom, driverRoom, bookingRoom, DRIVERS } from './rooms.js';

// Per-connection setup + event handlers.
export function registerHandlers(io, socket) {
  const user = socket.data.user;
  const driver = socket.data.driver;

  // Auto-join personal rooms.
  socket.join(userRoom(user.id));
  if (driver) {
    socket.join(driverRoom(driver.id));
    socket.join(DRIVERS); // receive new ride requests
  }

  // Join a specific booking thread (chat + live status).
  socket.on('booking:join', (bookingId) => {
    if (typeof bookingId === 'string' && bookingId) socket.join(bookingRoom(bookingId));
  });

  // Typing indicator (no persistence).
  socket.on('chat:typing', (payload = {}) => {
    const { bookingId } = payload;
    if (bookingId) socket.to(bookingRoom(bookingId)).emit('chat:typing', { userId: user.id });
  });

  // Send a chat message — authorize (owner or assigned driver), persist, broadcast.
  socket.on('chat:message', async (payload = {}, ack) => {
    try {
      const { bookingId, text } = payload;
      if (!bookingId || !text || !text.trim()) return ack?.({ error: 'Invalid message' });

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) return ack?.({ error: 'Booking not found' });

      const isOwner = booking.userId === user.id;
      const isAssignedDriver = driver && booking.driverId === driver.id;
      if (!isOwner && !isAssignedDriver) return ack?.({ error: 'Forbidden' });

      const message = await prisma.chatMessage.create({
        data: {
          bookingId,
          senderType: isAssignedDriver ? 'DRIVER' : 'USER', // server decides — no spoofing
          text: text.trim(),
        },
      });

      io.to(bookingRoom(bookingId)).emit('chat:message', message);
      ack?.({ ok: true, message });
    } catch {
      ack?.({ error: 'Server error' });
    }
  });

  // Driver live location → broadcast to the ride's room (only the assigned driver).
  socket.on('driver:location', async (payload = {}) => {
    const { bookingId, lat, lng } = payload;
    if (!driver || !bookingId || typeof lat !== 'number' || typeof lng !== 'number') return;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.driverId !== driver.id) return;
    socket.to(bookingRoom(bookingId)).emit('driver:location', { lat, lng, at: Date.now() });
  });
}
