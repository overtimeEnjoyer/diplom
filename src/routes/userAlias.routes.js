import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as userMethodSectionController from '../controllers/userMethodSection.controller.js';
import * as makCardsController from '../controllers/makCards.controller.js';

/** Thesis-aligned aliases: /api/user/* */

const router = Router();

router.get('/methods/me', authenticate, asyncHandler(userMethodSectionController.mySections));
router.get('/mak/favorites', authenticate, asyncHandler(makCardsController.getFavorites));
router.put('/mak/favorites', authenticate, asyncHandler(makCardsController.setFavorites));
router.post('/mak/favorites/toggle', authenticate, asyncHandler(makCardsController.toggleFavorite));

export default router;
