import { Router } from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import * as chatController from '../controllers/chat.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  oneWayBookingSchema,
  hourlyBookingSchema,
  outstationBookingSchema,
  payBookingSchema,
  chatMessageSchema,
  reviewSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);

// Create bookings (Quick Actions)
router.post('/one-way', validate(oneWayBookingSchema), bookingController.createOneWay);
router.post('/hourly', validate(hourlyBookingSchema), bookingController.createHourly);
router.post('/outstation', validate(outstationBookingSchema), bookingController.createOutstation);

// Read / manage
router.get('/', bookingController.listBookings);
router.get('/:id', bookingController.getBooking);
router.post('/:id/cancel', bookingController.cancelBooking);
router.post('/:id/pay', validate(payBookingSchema), bookingController.payBooking);
router.post('/:id/review', validate(reviewSchema), bookingController.reviewBooking);

// Live chat tied to a booking
router.get('/:bookingId/messages', chatController.listMessages);
router.post('/:bookingId/messages', validate(chatMessageSchema), chatController.sendMessage);

export default router;
