import { verifyAuthToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Requires a valid Driver-Dost session JWT (issued after auth/OTP).
 * Attaches the full user record as req.user.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Missing bearer token');

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized('User no longer exists');

  req.user = user;
  next();
});

/**
 * Requires the authenticated user to be a DRIVER with a linked Driver profile.
 * Must run after requireAuth. Attaches req.driver.
 */
export const requireDriver = asyncHandler(async (req, _res, next) => {
  if (!req.user || req.user.role !== 'DRIVER') {
    throw ApiError.forbidden('Driver access only');
  }
  const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
  if (!driver) throw ApiError.forbidden('No driver profile linked to this account');
  req.driver = driver;
  next();
});
