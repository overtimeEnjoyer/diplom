import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as uploadsController from '../controllers/uploads.controller.js';

const router = Router();

router.post('/presign', authenticate, asyncHandler(uploadsController.presign));

export default router;
