import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import * as adminController from '../controllers/admin.controller.js';
import { confirmPaymentRules } from '../validators/payment.validator.js';
import { validate } from '../middlewares/validation.middleware.js';

const router = Router();
const adminOnly = requireRole('admin');
const contentStaff = requireRole('admin', 'specialist');

router.use(authenticate);

router.post(
  '/payments/confirm',
  adminOnly,
  confirmPaymentRules,
  validate,
  asyncHandler(adminController.confirmPayment),
);

router.get('/feedbacks', adminOnly, asyncHandler(adminController.listFeedbacks));
router.patch('/feedbacks/:id/processed', adminOnly, asyncHandler(adminController.markFeedbackProcessed));

router.get('/pricing', adminOnly, asyncHandler(adminController.getPricing));
router.put('/pricing', adminOnly, asyncHandler(adminController.updatePricing));

router.get('/users', adminOnly, asyncHandler(adminController.listUsers));
router.patch('/users/:id/tariff', adminOnly, asyncHandler(adminController.updateUserTariff));

router.get('/method-sections', contentStaff, asyncHandler(adminController.listMethodSections));
router.post('/method-sections', contentStaff, asyncHandler(adminController.createMethodSection));
router.patch('/method-sections/:id', contentStaff, asyncHandler(adminController.updateMethodSection));

router.get('/methods', contentStaff, asyncHandler(adminController.listMethods));
router.post('/methods', contentStaff, asyncHandler(adminController.createMethod));
router.patch('/methods/:id', contentStaff, asyncHandler(adminController.updateMethod));

export default router;
