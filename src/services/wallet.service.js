import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { publicUser } from './auth.service.js';
import { isGatewayConfigured, createOrder, gatewayKeyId, verifySignature } from './payment.service.js';
import { WALLET_PACKAGES, MANUAL_MIN, MANUAL_MAX } from '../config/walletPackages.js';

/** Packages + manual bounds for the app to render the Add Money sheet. */
export function getWalletOptions() {
  return {
    packages: WALLET_PACKAGES.map((p) => ({ ...p, credit: p.pay + p.bonus })),
    manual: { min: MANUAL_MIN, max: MANUAL_MAX },
  };
}

/**
 * Resolve a top-up request into money values, SERVER-SIDE (never trust the client
 * for amounts/bonus). Accepts a packageId OR a manual amount.
 * Returns { packageId, paidAmount, bonusAmount, creditAmount } (rupees).
 */
function resolveTopUp({ packageId, amount }) {
  if (packageId) {
    const p = WALLET_PACKAGES.find((x) => x.id === packageId);
    if (!p) throw ApiError.badRequest('Unknown wallet package');
    return { packageId: p.id, paidAmount: p.pay, bonusAmount: p.bonus, creditAmount: p.pay + p.bonus };
  }
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt < MANUAL_MIN) throw ApiError.badRequest(`Minimum top-up is Rs ${MANUAL_MIN}.`);
  if (amt > MANUAL_MAX) throw ApiError.badRequest(`Maximum top-up is Rs ${MANUAL_MAX}.`);
  return { packageId: null, paidAmount: amt, bonusAmount: 0, creditAmount: amt };
}

/**
 * Start an "Add Money to Wallet" payment (package or manual amount).
 *  - Gateway configured → Razorpay order for the PAID amount + a PENDING ledger row.
 *  - No gateway keys (dev) → credit the full CREDIT amount immediately (mock).
 * Returns { needsCheckout, order } OR { mock, user }.
 */
export async function createWalletTopUpOrder(userId, body) {
  const { packageId, paidAmount, bonusAmount, creditAmount } = resolveTopUp(body);

  if (isGatewayConfigured()) {
    const order = await createOrder(paidAmount, `wallet_${userId.slice(0, 8)}_${Date.now().toString(36)}`);
    await prisma.walletTopUp.create({
      data: {
        userId,
        orderId: order.id,
        packageId,
        amount: paidAmount,
        bonusAmount,
        creditAmount,
        status: 'PENDING',
      },
    });
    return {
      needsCheckout: true,
      order: { id: order.id, amount: order.amount, currency: order.currency, keyId: gatewayKeyId() },
    };
  }

  // Dev mock (no Razorpay keys) — credit the full amount (incl. bonus) immediately.
  const user = await prisma.user.update({
    where: { id: userId },
    data: { walletBalance: { increment: creditAmount } },
  });
  return { mock: true, user: publicUser(user) };
}

/**
 * Verify a Razorpay top-up result and credit the wallet exactly once (credit =
 * paid + bonus). Idempotent: a second call for an already-PAID order is a no-op.
 */
export async function verifyWalletTopUp(userId, { orderId, paymentId, signature }) {
  const topup = await prisma.walletTopUp.findUnique({ where: { orderId } });
  if (!topup || topup.userId !== userId) throw ApiError.notFound('Top-up not found');

  if (topup.status === 'PAID') {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    return { user: publicUser(current) };
  }

  if (!verifySignature(orderId, paymentId, signature)) {
    await prisma.walletTopUp.update({ where: { orderId }, data: { status: 'FAILED', paymentId } });
    throw ApiError.badRequest('Payment verification failed');
  }

  const user = await prisma.$transaction(async (tx) => {
    // Signature is already verified above, so a previously-FAILED row may now be
    // credited on a valid retry. PAID is the only terminal state (short-circuited above),
    // so this still credits exactly once.
    const claimed = await tx.walletTopUp.updateMany({
      where: { orderId, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PAID', paymentId },
    });
    if (claimed.count === 0) {
      // Another request credited it first — no double credit.
      return tx.user.findUnique({ where: { id: userId } });
    }
    return tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: Number(topup.creditAmount) } },
    });
  });

  return { user: publicUser(user) };
}
