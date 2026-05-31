import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import * as paymentsController from '../controllers/payments.controller.js';
import { confirmPaymentRules } from '../validators/payment.validator.js';

const router = Router();

router.get('/status', asyncHandler(paymentsController.paymentStatus));
router.post(
  '/confirm',
  authenticate,
  confirmPaymentRules,
  validate,
  asyncHandler(paymentsController.confirmPayment),
);

export default router;
