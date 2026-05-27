import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as contentController from '../controllers/content.controller.js';

const router = Router();

router.get('/method-sections', asyncHandler(contentController.listMethodSections));
router.get('/method-sections/:id', asyncHandler(contentController.getMethodSection));
router.get('/methods', asyncHandler(contentController.listMethods));
router.get('/methods/:id', asyncHandler(contentController.getMethod));
router.get('/pricing', asyncHandler(contentController.getPricing));

export default router;
