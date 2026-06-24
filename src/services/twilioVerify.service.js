// Twilio Verify integration — Twilio generates, sends and checks the OTP for us
// (no code stored on our side, India-friendly delivery). Configure with:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
import { toE164 } from './sms.service.js';

export function isVerifyConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID
  );
}

function authHeader() {
  const creds = `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`;
  return 'Basic ' + Buffer.from(creds).toString('base64');
}

const base = () =>
  `https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}`;

/** Ask Twilio to send an OTP SMS to the phone. */
export async function startVerification(phone) {
  const res = await fetch(`${base()}/Verifications`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: toE164(phone), Channel: 'sms' }),
  });
  if (!res.ok) throw new Error(`Twilio Verify start ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Check a code the user entered. Returns true only if Twilio says "approved". */
export async function checkVerification(phone, code) {
  const res = await fetch(`${base()}/VerificationCheck`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: toE164(phone), Code: String(code) }),
  });
  // 404 = no pending/expired verification; treat as failed rather than throwing.
  if (!res.ok) return false;
  const data = await res.json();
  return data.status === 'approved';
}
