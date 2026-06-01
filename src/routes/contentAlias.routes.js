import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as contentAliasController from '../controllers/contentAlias.controller.js';

const router = Router();

router.get('/sections', asyncHandler(contentAliasController.listSections));
router.get('/methods/:slug', authenticate, asyncHandler(contentAliasController.getMethodBySlug));
router.get('/pricing', asyncHandler(contentAliasController.getPricing));

export default router;
