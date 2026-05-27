import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middlewares/validation.middleware.js';
import * as feedbackController from '../controllers/feedback.controller.js';
import { feedbackRules } from '../validators/material.validator.js';

const router = Router();

router.post('/', feedbackRules, validate, asyncHandler(feedbackController.sendFeedback));

export default router;
