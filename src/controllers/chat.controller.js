import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { notify } from '../services/notification.service.js';

// Either the booking's user OR its assigned driver may access the thread.
async function assertParticipant(req, bookingId) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw ApiError.notFound('Booking not found');
  const isOwner = booking.userId === req.user.id;
  const isAssignedDriver = req.driver && booking.driverId === req.driver.id;
  if (!isOwner && !isAssignedDriver) throw ApiError.notFound('Booking not found');
  return booking;
}

export const listMessages = asyncHandler(async (req, res) => {
  await assertParticipant(req, req.params.bookingId);
  const messages = await prisma.chatMessage.findMany({
    where: { bookingId: req.params.bookingId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: messages });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const booking = await assertParticipant(req, req.params.bookingId);

  // Derive the sender from the AUTHENTICATED identity, never the request body —
  // otherwise a participant could spoof the other side and misroute the notification.
  const isOwner = booking.userId === req.user.id;
  const senderType = isOwner ? 'USER' : 'DRIVER';

  const message = await prisma.chatMessage.create({
    data: {
      bookingId: req.params.bookingId,
      senderType,
      text: req.body.text,
    },
  });

  // Notify the OTHER participant. USER sent → the assigned driver's account; DRIVER → the rider.
  let recipientUserId = null;
  if (isOwner) {
    if (booking.driverId) {
      const driver = await prisma.driver.findUnique({
        where: { id: booking.driverId },
        select: { userId: true },
      });
      recipientUserId = driver?.userId ?? null;
    }
  } else {
    recipientUserId = booking.userId;
  }
  if (recipientUserId) {
    notify(recipientUserId, {
      type: 'CHAT_MESSAGE',
      title: 'New message',
      body: message.text.slice(0, 100),
      data: { bookingId: req.params.bookingId },
    });
  }

  res.status(201).json({ success: true, data: message });
});
