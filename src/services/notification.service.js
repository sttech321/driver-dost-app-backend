import { prisma } from '../config/prisma.js';
import { emitNotification } from '../socket/events.js';

/**
 * Persist an in-app notification and push it live to the user's socket room.
 * Best-effort: never throws into the caller's flow (a ride/payment must not fail
 * just because a notification couldn't be written/emitted).
 * @param {string} userId
 * @param {{type: string, title: string, body: string, data?: object}} payload
 */
export async function notify(userId, { type, title, body, data } = {}) {
  if (!userId || !type) return null;
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, body, data: data ?? undefined },
    });
    emitNotification(userId, notification);
    return notification;
  } catch (err) {
    console.error('[notification] failed to create:', err?.message);
    return null;
  }
}

export async function listNotifications(userId, { limit = 30, before } = {}) {
  return prisma.notification.findMany({
    where: { userId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 30, 100),
  });
}

export function unreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

/** Mark one notification read (scoped to the owner). Returns the updated count. */
export async function markRead(userId, id) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  return unreadCount(userId);
}

export async function markAllRead(userId) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  return 0;
}
