import { createHmac, timingSafeEqual } from 'node:crypto';

// Razorpay gateway for online payments (Card / UPI / netbanking / wallets).
// Configure RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET to go live; without them the
// app runs online payments in DEV-MOCK mode (marks paid without a real charge).
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export function isGatewayConfigured() {
  return Boolean(KEY_ID && KEY_SECRET);
}

export function gatewayKeyId() {
  return KEY_ID || null;
}

/** Create a Razorpay order for an amount in rupees. */
export async function createOrder(amountRupees, receipt) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(Number(amountRupees) * 100), // paise
      currency: 'INR',
      // Razorpay caps receipt at 40 chars — truncate defensively.
      receipt: receipt ? String(receipt).slice(0, 40) : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed: ${res.status} ${await res.text()}`);
  return res.json(); // { id, amount, currency, ... }
}

/** Verify the checkout callback signature (order_id|payment_id signed with secret). */
export function verifySignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature || !KEY_SECRET) return false;
  const expected = createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}
