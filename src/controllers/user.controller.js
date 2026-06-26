import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '../config/prisma.js';
import { publicUser } from '../services/auth.service.js';
import * as walletService from '../services/wallet.service.js';

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

// Predefined packages + manual bounds for the Add Money sheet.
export const getWalletOptions = asyncHandler(async (req, res) => {
  res.json({ success: true, data: walletService.getWalletOptions() });
});

// Start an "Add Money via Razorpay" payment (packageId OR amount)
// → { needsCheckout, order } or { mock, user }.
export const createWalletTopUpOrder = asyncHandler(async (req, res) => {
  const result = await walletService.createWalletTopUpOrder(req.user.id, req.body);
  res.json({ success: true, data: result });
});

// Verify the Razorpay top-up and credit the wallet → { user }.
export const verifyWalletTopUp = asyncHandler(async (req, res) => {
  const result = await walletService.verifyWalletTopUp(req.user.id, req.body);
  res.json({ success: true, data: result });
});
