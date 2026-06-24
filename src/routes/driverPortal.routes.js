import { Router } from 'express';
import * as controller from '../controllers/driverPortal.controller.js';
import * as chatController from '../controllers/chat.controller.js';
import { requireAuth, requireDriver } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { driverStatusSchema, chatMessageSchema } from '../validators/schemas.js';

// Logged-in DRIVER portal — see/accept ride requests and manage trips.
const router = Router();

router.use(requireAuth, requireDriver);

router.get('/me', controller.me);
router.get('/requests', controller.listRequests);
router.post('/requests/:id/accept', controller.acceptRequest);
router.get('/bookings', controller.myBookings);
router.post('/bookings/:id/status', validate(driverStatusSchema), controller.updateStatus);

// Chat from the driver side (same booking thread as the user).
router.get('/bookings/:bookingId/messages', chatController.listMessages);
router.post('/bookings/:bookingId/messages', validate(chatMessageSchema), chatController.sendMessage);

export default router;
