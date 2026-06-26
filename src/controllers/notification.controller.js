import { asyncHandler } from '../utils/asyncHandler.js';
import * as notificationService from '../services/notification.service.js';

export const list = asyncHandler(async (req, res) => {
  const items = await notificationService.listNotifications(req.user.id, {
    limit: req.query.limit,
    before: req.query.before,
  });
  res.json({ success: true, data: items });
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCount(req.user.id);
  res.json({ success: true, data: { count } });
});

export const markRead = asyncHandler(async (req, res) => {
  const count = await notificationService.markRead(req.user.id, req.params.id);
  res.json({ success: true, data: { count } });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const count = await notificationService.markAllRead(req.user.id);
  res.json({ success: true, data: { count } });
});
