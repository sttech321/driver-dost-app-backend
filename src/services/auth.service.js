import { prisma } from '../config/prisma.js';
import { verifyFirebaseIdToken, isFirebaseEnabled } from '../config/firebase.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAuthToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyOtp as verifyFallbackOtp } from './otp.service.js';

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

// Deterministic, unique driver code derived from the user id (e.g. DDA1B2C3).
function driverCodeFor(userId) {
  return 'DD' + userId.replace(/-/g, '').slice(0, 6).toUpperCase();
}

/** Register with phone + password (Register tab). role: USER | DRIVER. */
export async function registerWithPassword({ phone, password, name, email, role = 'USER' }) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
  });
  if (existing) throw ApiError.conflict('An account with this phone/email already exists');

  const user = await prisma.user.create({
    data: {
      phone,
      email,
      name,
      role,
      provider: 'PASSWORD',
      passwordHash: hashPassword(password),
    },
  });

  // A driver account gets a linked Driver profile so it can receive bookings.
  if (role === 'DRIVER') {
    await prisma.driver.create({
      data: {
        userId: user.id,
        code: driverCodeFor(user.id),
        name: name || 'Driver',
        title: 'Verified Driver',
        phone,
        isAvailable: true,
      },
    });
  }

  return { user: publicUser(user), token: signAuthToken(user) };
}

/** Login with phone + password (Login tab). */
export async function loginWithPassword({ phone, password }) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw ApiError.unauthorized('Invalid phone number or password');
  }
  return { user: publicUser(user), token: signAuthToken(user) };
}

/**
 * Sign in / up via a Firebase ID token — covers BOTH "Continue with Google"
 * and phone-OTP (the app gets the ID token from the Firebase SDK after the
 * user enters the OTP on Screen 3). We upsert by firebaseUid.
 */
export async function loginWithFirebase(idToken) {
  if (!isFirebaseEnabled()) {
    throw ApiError.badRequest('Firebase auth is not configured on the server');
  }
  const decoded = await verifyFirebaseIdToken(idToken);

  const provider = decoded.firebase?.sign_in_provider === 'google.com' ? 'GOOGLE' : 'PHONE';

  const user = await prisma.user.upsert({
    where: { firebaseUid: decoded.uid },
    update: {
      phone: decoded.phone_number ?? undefined,
      email: decoded.email ?? undefined,
      name: decoded.name ?? undefined,
      photoUrl: decoded.picture ?? undefined,
      isPhoneVerified: provider === 'PHONE' ? true : undefined,
    },
    create: {
      firebaseUid: decoded.uid,
      phone: decoded.phone_number ?? null,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
      photoUrl: decoded.picture ?? null,
      provider,
      isPhoneVerified: provider === 'PHONE',
    },
  });

  return { user: publicUser(user), token: signAuthToken(user) };
}

/**
 * Verify phone via the fallback OTP store (when Firebase isn't configured).
 * Creates the user if new, marks the phone verified, returns a session token.
 */
export async function verifyPhoneFallback({ phone, code }) {
  const ok = await verifyFallbackOtp(phone, code);
  if (!ok) throw ApiError.unauthorized('Invalid or expired OTP');

  const user = await prisma.user.upsert({
    where: { phone },
    update: { isPhoneVerified: true },
    create: { phone, provider: 'PHONE', isPhoneVerified: true },
  });
  return { user: publicUser(user), token: signAuthToken(user) };
}

/** Forgot-password: reset using a verified phone number. */
export async function resetPasswordWithPhone({ phone, code, newPassword, firebaseIdToken }) {
  // Accept either a fallback OTP code or a Firebase ID token as proof of ownership.
  let verified = false;
  if (firebaseIdToken && isFirebaseEnabled()) {
    const decoded = await verifyFirebaseIdToken(firebaseIdToken);
    verified = decoded.phone_number === phone;
  } else if (code) {
    verified = await verifyFallbackOtp(phone, code);
  }
  if (!verified) throw ApiError.unauthorized('Phone ownership not verified');

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) throw ApiError.notFound('No account found for this phone number');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });
  return { user: publicUser(updated), token: signAuthToken(updated) };
}

export { publicUser };
