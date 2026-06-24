import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// Saved Places are always scoped to the logged-in user id.
export const listSavedPlaces = asyncHandler(async (req, res) => {
  const places = await prisma.savedPlace.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: places });
});

export const createSavedPlace = asyncHandler(async (req, res) => {
  const place = await prisma.savedPlace.create({
    data: { ...req.body, userId: req.user.id },
  });
  res.status(201).json({ success: true, data: place });
});

export const deleteSavedPlace = asyncHandler(async (req, res) => {
  const place = await prisma.savedPlace.findUnique({ where: { id: req.params.id } });
  if (!place || place.userId !== req.user.id) throw ApiError.notFound('Saved place not found');
  await prisma.savedPlace.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: { id: req.params.id } });
});
