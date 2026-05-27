import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middlewares/validation.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as authController from '../controllers/auth.controller.js';
import { registerRules, loginRules, resetPasswordRules } from '../validators/auth.validator.js';

const router = Router();

router.post('/register', registerRules, validate, asyncHandler(authController.register));
router.post('/local', loginRules, validate, asyncHandler(authController.loginLocal));
router.post('/email/request-code', asyncHandler(authController.requestEmailCode));
router.post('/email/verify-code', asyncHandler(authController.verifyEmailCode));
router.post('/password/request-code', asyncHandler(authController.requestPasswordCode));
router.post('/password/reset', resetPasswordRules, validate, asyncHandler(authController.resetPassword));
router.get('/me', authenticate, asyncHandler(authController.me));
router.put('/profile', authenticate, asyncHandler(authController.updateProfile));
router.post('/profile', authenticate, asyncHandler(authController.updateProfile));

export default router;
