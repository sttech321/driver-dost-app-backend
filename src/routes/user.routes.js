import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import * as savedPlaceController from '../controllers/savedPlace.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  updateProfileSchema,
  savedPlaceSchema,
  walletTopUpOrderSchema,
  verifyPaymentSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);

// Profile
router.get('/me', userController.getProfile);
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);
// "Add Money via Razorpay": packages + create order → checkout → verify + credit.
// (No direct-credit endpoint — money only moves through the verified gateway flow.)
router.get('/me/wallet/packages', userController.getWalletOptions);
router.post('/me/wallet/topup/order', validate(walletTopUpOrderSchema), userController.createWalletTopUpOrder);
router.post('/me/wallet/topup/verify', validate(verifyPaymentSchema), userController.verifyWalletTopUp);

// Saved Places (scoped to user id)
router.get('/me/saved-places', savedPlaceController.listSavedPlaces);
router.post('/me/saved-places', validate(savedPlaceSchema), savedPlaceController.createSavedPlace);
router.delete('/me/saved-places/:id', savedPlaceController.deleteSavedPlace);

export default router;
