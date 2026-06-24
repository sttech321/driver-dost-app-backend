import { asyncHandler } from '../utils/asyncHandler.js';
import * as authService from '../services/auth.service.js';
import { generateOtp } from '../services/otp.service.js';
import { isFirebaseEnabled } from '../config/firebase.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerWithPassword(req.body);
  res.status(201).json({ success: true, data: result });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginWithPassword(req.body);
  res.json({ success: true, data: result });
});

// Used by "Continue with Google" and Firebase phone-OTP sign-in.
export const firebaseLogin = asyncHandler(async (req, res) => {
  const result = await authService.loginWithFirebase(req.body.idToken);
  res.json({ success: true, data: result });
});

// Fallback OTP send (when Firebase phone auth isn't configured).
export const sendOtp = asyncHandler(async (req, res) => {
  const result = await generateOtp(req.body.phone);
  res.json({ success: true, data: { ...result, firebaseEnabled: isFirebaseEnabled() } });
});

// Fallback OTP verify — Screen 3.
export const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyPhoneFallback(req.body);
  res.json({ success: true, data: result });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPasswordWithPhone(req.body);
  res.json({ success: true, data: result });
});

export const config = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { firebaseEnabled: isFirebaseEnabled() } });
});
