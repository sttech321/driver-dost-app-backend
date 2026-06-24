import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  firebaseLoginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
} from '../validators/schemas.js';

const router = Router();

router.get('/config', authController.config);
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/firebase', validate(firebaseLoginSchema), authController.firebaseLogin);
router.post('/otp/send', validate(sendOtpSchema), authController.sendOtp);
router.post('/otp/verify', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

export default router;
