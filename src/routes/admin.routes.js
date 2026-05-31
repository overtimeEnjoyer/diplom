import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import * as adminController from '../controllers/admin.controller.js';
import { confirmPaymentRules } from '../validators/payment.validator.js';
import { validate } from '../middlewares/validation.middleware.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.post('/payments/confirm', confirmPaymentRules, validate, asyncHandler(adminController.confirmPayment));

router.get('/feedbacks', asyncHandler(adminController.listFeedbacks));
router.patch('/feedbacks/:id/processed', asyncHandler(adminController.markFeedbackProcessed));

router.get('/pricing', asyncHandler(adminController.getPricing));
router.put('/pricing', asyncHandler(adminController.updatePricing));

router.get('/users', asyncHandler(adminController.listUsers));
router.patch('/users/:id/tariff', asyncHandler(adminController.updateUserTariff));

router.get('/method-sections', asyncHandler(adminController.listMethodSections));
router.post('/method-sections', asyncHandler(adminController.createMethodSection));
router.patch('/method-sections/:id', asyncHandler(adminController.updateMethodSection));

router.get('/methods', asyncHandler(adminController.listMethods));
router.post('/methods', asyncHandler(adminController.createMethod));
router.patch('/methods/:id', asyncHandler(adminController.updateMethod));

export default router;
