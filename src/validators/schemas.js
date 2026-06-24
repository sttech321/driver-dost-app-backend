import { z } from 'zod';

const phone = z.string().min(8).max(20);
const password = z.string().min(6).max(100);

export const registerSchema = z.object({
  phone,
  password,
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(['USER', 'DRIVER']).default('USER'),
});

export const loginSchema = z.object({ phone, password });

export const firebaseLoginSchema = z.object({ idToken: z.string().min(10) });

export const sendOtpSchema = z.object({ phone });

export const verifyOtpSchema = z.object({ phone, code: z.string().min(4).max(8) });

export const forgotPasswordSchema = z
  .object({
    phone,
    newPassword: password,
    code: z.string().min(4).max(8).optional(),
    firebaseIdToken: z.string().min(10).optional(),
  })
  .refine((d) => d.code || d.firebaseIdToken, {
    message: 'Provide either an OTP code or a Firebase ID token',
  });

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
});

const latLng = {
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
};

export const savedPlaceSchema = z.object({
  label: z.string().min(1).max(120),
  addressLine: z.string().min(1).max(240),
  ...latLng,
});

export const oneWayBookingSchema = z.object({
  pickupLabel: z.string().optional(),
  pickupAddress: z.string().optional(),
  pickupLat: latLng.lat,
  pickupLng: latLng.lng,
  destinationLabel: z.string().optional(),
  destinationAddress: z.string().optional(),
  destinationLat: latLng.lat,
  destinationLng: latLng.lng,
  scheduledAt: z.coerce.date().optional(),
  distanceKm: z.number().positive().optional(),
  etaMinutes: z.number().int().positive().optional(),
});

export const hourlyBookingSchema = z.object({
  pickupLabel: z.string().optional(),
  pickupAddress: z.string().optional(),
  pickupLat: latLng.lat,
  pickupLng: latLng.lng,
  scheduledAt: z.coerce.date().optional(),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
});

export const outstationBookingSchema = z.object({
  pickupLabel: z.string().optional(),
  pickupAddress: z.string().optional(),
  pickupLat: latLng.lat,
  pickupLng: latLng.lng,
  destinationLabel: z.string().optional(),
  destinationAddress: z.string().optional(),
  destinationLat: latLng.lat,
  destinationLng: latLng.lng,
  scheduledAt: z.coerce.date().optional(),
  outstationType: z.enum(['ROUND_TRIP', 'ONE_WAY']),
});

export const payBookingSchema = z.object({
  paymentMethod: z.enum(['CREDIT_CARD', 'UPI', 'CASH', 'WALLET']),
});

export const chatMessageSchema = z.object({
  text: z.string().min(1).max(2000),
  senderType: z.enum(['USER', 'DRIVER']).default('USER'),
});

export const driverStatusSchema = z.object({
  status: z.enum(['ARRIVING', 'ONGOING', 'COMPLETED', 'CANCELLED']),
});
