import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as paymentsController from '../controllers/payments.controller.js';

const router = Router();

// wayforpay-callback is registered in app.js with raw body parser
router.get('/status', asyncHandler(paymentsController.paymentStatus));

export default router;
