import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import driverRoutes from './driver.routes.js';
import bookingRoutes from './booking.routes.js';
import geocodeRoutes from './geocode.routes.js';
import driverPortalRoutes from './driverPortal.routes.js';
import notificationRoutes from './notification.routes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok' }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/drivers', driverRoutes);
router.use('/driver', driverPortalRoutes);
router.use('/bookings', bookingRoutes);
router.use('/geocode', geocodeRoutes);
router.use('/notifications', notificationRoutes);

export default router;
