import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middlewares/validation.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../utils/rateLimit.js';
import { env } from '../config/env.js';
import * as authController from '../controllers/auth.controller.js';
import {
  registerRules,
  loginRules,
  resetPasswordRules,
  emailOnlyRules,
  emailCodeRules,
} from '../validators/auth.validator.js';

const router = Router();

const authRateLimit = createRateLimiter({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  keyFn: (req) => `${req.ip}:${req.path}`,
});

router.post('/register', authRateLimit, registerRules, validate, asyncHandler(authController.register));
router.post('/local', authRateLimit, loginRules, validate, asyncHandler(authController.loginLocal));
router.post('/sync', authRateLimit, asyncHandler(authController.syncSupabase));
router.post('/mfa/verify', authRateLimit, asyncHandler(authController.verifyMfa));
router.post('/mfa/enable', authenticate, asyncHandler(authController.enableMfa));
router.post('/mfa/disable', authenticate, asyncHandler(authController.disableMfa));
router.post('/email/request-code', authRateLimit, emailOnlyRules, validate, asyncHandler(authController.requestEmailCode));
router.post('/email/verify-code', authRateLimit, emailCodeRules, validate, asyncHandler(authController.verifyEmailCode));
router.post('/password/request-code', authRateLimit, emailOnlyRules, validate, asyncHandler(authController.requestPasswordCode));
router.post('/password/reset', authRateLimit, resetPasswordRules, validate, asyncHandler(authController.resetPassword));
router.get('/me', authenticate, asyncHandler(authController.me));
router.put('/profile', authenticate, asyncHandler(authController.updateProfile));
router.post('/profile', authenticate, asyncHandler(authController.updateProfile));

export default router;
