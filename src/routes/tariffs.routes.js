import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as userMethodSectionController from '../controllers/userMethodSection.controller.js';

const router = Router();

router.post('/medium/activate', authenticate, asyncHandler(userMethodSectionController.activateMedium));
router.post('/premium/activate', authenticate, asyncHandler(userMethodSectionController.activatePremium));

export default router;
