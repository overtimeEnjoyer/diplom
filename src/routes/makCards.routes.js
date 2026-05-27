import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.get('/favorites', authenticate, asyncHandler(authController.getMakFavorites));
router.put('/favorites', authenticate, asyncHandler(authController.setMakFavorites));
router.post('/favorites/toggle', authenticate, asyncHandler(authController.toggleMakFavorite));
router.post('/access', authenticate, asyncHandler(authController.grantMakCardsAccess));

export default router;
