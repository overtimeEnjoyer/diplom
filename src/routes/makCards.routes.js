import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import * as makCardsController from '../controllers/makCards.controller.js';
import { setFavoritesRules, toggleFavoriteRules } from '../validators/makCards.validator.js';

const router = Router();

router.get('/favorites', authenticate, asyncHandler(makCardsController.getFavorites));
router.put('/favorites', authenticate, setFavoritesRules, validate, asyncHandler(makCardsController.setFavorites));
router.post(
  '/favorites/toggle',
  authenticate,
  toggleFavoriteRules,
  validate,
  asyncHandler(makCardsController.toggleFavorite),
);
router.post('/access', authenticate, asyncHandler(makCardsController.requestAccess));

export default router;
