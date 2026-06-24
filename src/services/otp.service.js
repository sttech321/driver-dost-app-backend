import { createHash, randomInt } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

// Fallback OTP flow — only used when Firebase phone auth is NOT configured.
// In production you'd swap the "delivery" step for a real SMS provider.

const hashCode = (code) => createHash('sha256').update(code).digest('hex');

export async function generateOtp(phone) {
  const code = String(randomInt(1000, 9999)); // 4-digit, matches the UI
  const expiresAt = new Date(Date.now() + env.otp.ttlSeconds * 1000);

  await prisma.otpCode.create({
    data: { phone, codeHash: hashCode(code), expiresAt },
  });

  if (env.otp.devLog) {
    console.log(`[otp] ${phone} -> ${code} (valid ${env.otp.ttlSeconds}s)`);
  }
  // TODO: integrate real SMS provider here for production delivery.
  return { sent: true, devCode: env.isProd ? undefined : code };
}

export async function verifyOtp(phone, code) {
  const record = await prisma.otpCode.findFirst({
    where: { phone, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return false;
  if (record.codeHash !== hashCode(code)) return false;

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumed: true },
  });
  return true;
}
