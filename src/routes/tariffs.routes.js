import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as tariffsController from '../controllers/tariffs.controller.js';

const router = Router();

router.post('/medium/activate', authenticate, asyncHandler(tariffsController.activateMedium));
router.post('/premium/activate', authenticate, asyncHandler(tariffsController.activatePremium));

export default router;
