import { Router } from 'express';
import * as geocodeController from '../controllers/geocode.controller.js';

// Public utility endpoints (no user data) — used by the booking screens'
// address autocomplete and map picker.
const router = Router();

router.get('/search', geocodeController.search);
router.get('/reverse', geocodeController.reverse);
router.get('/route', geocodeController.route);

export default router;
