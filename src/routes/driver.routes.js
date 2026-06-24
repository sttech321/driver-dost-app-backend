import { Router } from 'express';
import * as driverController from '../controllers/driver.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/recommended', driverController.listRecommended);
router.get('/:id', driverController.getDriver);

export default router;
