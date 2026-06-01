import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as progressController from '../controllers/progress.controller.js';

const router = Router();

router.post('/methods/:methodId/view', authenticate, asyncHandler(progressController.recordView));
router.get('/me', authenticate, asyncHandler(progressController.myHistory));
router.post('/tests', authenticate, asyncHandler(progressController.saveTestResult));
router.get('/tests/me', authenticate, asyncHandler(progressController.listTestResults));

export default router;
