import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as userMethodSectionController from '../controllers/userMethodSection.controller.js';
import * as makCardsController from '../controllers/makCards.controller.js';
import * as methodFavoritesController from '../controllers/methodFavorites.controller.js';

/** Thesis-aligned aliases: /api/user/* */

const router = Router();

router.get('/methods/me', authenticate, asyncHandler(userMethodSectionController.mySections));
router.get('/methods/favorites', authenticate, asyncHandler(methodFavoritesController.listFavorites));
router.post('/methods/favorites', authenticate, asyncHandler(methodFavoritesController.addFavorite));
router.get('/mak/favorites', authenticate, asyncHandler(makCardsController.getFavorites));
router.put('/mak/favorites', authenticate, asyncHandler(makCardsController.setFavorites));
router.post('/mak/favorites/toggle', authenticate, asyncHandler(makCardsController.toggleFavorite));

export default router;
