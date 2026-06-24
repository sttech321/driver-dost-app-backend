import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '../config/prisma.js';
import { publicUser } from '../services/auth.service.js';

export const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: req.body,
  });
  res.json({ success: true, data: publicUser(user) });
});
