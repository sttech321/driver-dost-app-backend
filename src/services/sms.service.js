// Pluggable SMS sender. Configure ONE provider via .env and OTPs go to the
// real phone; with none configured it falls back to logging (dev).
//
// Supported (pick one):
//   • Twilio   — global. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//   • Fast2SMS — India.  Needs FAST2SMS_API_KEY
const DEFAULT_CC = process.env.SMS_DEFAULT_COUNTRY_CODE || '91'; // India

// Normalise to E.164 (e.g. +918091739353) for Twilio.
export function toE164(phone) {
  const raw = String(phone).trim();
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+${DEFAULT_CC}${digits}`;
  return `+${digits}`;
}

async function sendViaTwilio(phone, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: toE164(phone), Body: message }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  return { provider: 'twilio' };
}

async function sendViaFast2SMS(phone, message) {
  // Fast2SMS wants a 10-digit Indian number (no country code).
  const numbers = String(phone).replace(/\D/g, '').slice(-10);
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: process.env.FAST2SMS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ route: 'q', message, numbers, flash: 0 }),
  });
  if (!res.ok) throw new Error(`Fast2SMS ${res.status}: ${await res.text()}`);
  return { provider: 'fast2sms' };
}

/**
 * Send an SMS via whichever provider is configured.
 * Returns { provider }. Never throws for the dev/console path.
 */
export async function sendSms(phone, message) {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    return sendViaTwilio(phone, message);
  }
  if (process.env.FAST2SMS_API_KEY) {
    return sendViaFast2SMS(phone, message);
  }
  console.log(`[sms:dev] (no provider configured) to ${phone}: ${message}`);
  return { provider: 'console' };
}

export function isSmsConfigured() {
  return Boolean(
    (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) ||
      process.env.FAST2SMS_API_KEY
  );
}
