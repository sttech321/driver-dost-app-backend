import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

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
  await assertParticipant(req, req.params.bookingId);
  const message = await prisma.chatMessage.create({
    data: {
      bookingId: req.params.bookingId,
      senderType: req.body.senderType,
      text: req.body.text,
    },
  });
  res.status(201).json({ success: true, data: message });
});
