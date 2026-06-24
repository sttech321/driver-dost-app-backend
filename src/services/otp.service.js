import { createHash, randomInt } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { sendSms, isSmsConfigured } from './sms.service.js';
import { isVerifyConfigured, startVerification, checkVerification } from './twilioVerify.service.js';

// OTP delivery preference:
//   1. Twilio Verify (Twilio generates+sends+checks) — if configured
//   2. SMS provider  (we generate code, send via Twilio/Fast2SMS)
//   3. Dev console    (code logged + returned to the UI)

const hashCode = (code) => createHash('sha256').update(code).digest('hex');

export async function generateOtp(phone) {
  // 1) Twilio Verify — Twilio owns the code lifecycle, nothing stored here.
  if (isVerifyConfigured()) {
    await startVerification(phone);
    return { sent: true, delivered: true, channel: 'twilio-verify' };
  }

  const code = String(randomInt(100000, 1000000)); // 6-digit (matches Twilio Verify + UI)
  const minutes = Math.round(env.otp.ttlSeconds / 60);
  const expiresAt = new Date(Date.now() + env.otp.ttlSeconds * 1000);

  await prisma.otpCode.create({
    data: { phone, codeHash: hashCode(code), expiresAt },
  });

  // Deliver to the real phone via SMS provider (Twilio / Fast2SMS).
  const message = `Your Driver Dost OTP is ${code}. Valid for ${minutes} minutes.`;
  let delivered = false;
  try {
    const result = await sendSms(phone, message);
    delivered = result.provider !== 'console';
  } catch (err) {
    console.error('[otp] SMS delivery failed:', err.message);
  }

  if (env.otp.devLog) {
    console.log(`[otp] ${phone} -> ${code} (valid ${env.otp.ttlSeconds}s)`);
  }
  // In dev (no SMS provider), return the code so the UI can show it.
  return { sent: true, delivered, devCode: env.isProd || delivered ? undefined : code };
}

export { isSmsConfigured };

export async function verifyOtp(phone, code) {
  // 1) Twilio Verify check.
  if (isVerifyConfigured()) {
    return checkVerification(phone, code);
  }

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
