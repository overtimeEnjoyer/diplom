import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import * as controller from '../controllers/userMethodSection.controller.js';
import { assignSectionRules } from '../validators/material.validator.js';

const router = Router();

router.post('/assign', authenticate, assignSectionRules, validate, asyncHandler(controller.assign));
router.get('/me', authenticate, asyncHandler(controller.mySections));

export default router;
