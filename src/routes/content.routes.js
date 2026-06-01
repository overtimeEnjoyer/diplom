import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as contentController from '../controllers/content.controller.js';
import * as methodFavoritesController from '../controllers/methodFavorites.controller.js';

const router = Router();

router.get('/method-sections', asyncHandler(contentController.listMethodSections));
router.get('/method-sections/:id', asyncHandler(contentController.getMethodSection));
router.get('/methods/favorites', authenticate, asyncHandler(methodFavoritesController.listFavorites));
router.put('/methods/favorites', authenticate, asyncHandler(methodFavoritesController.setFavorites));
router.post('/methods/favorites', authenticate, asyncHandler(methodFavoritesController.addFavorite));
router.post('/methods/favorites/toggle', authenticate, asyncHandler(methodFavoritesController.toggleFavorite));
router.get('/methods', asyncHandler(contentController.listMethods));
router.get('/methods/search', asyncHandler(contentController.searchMethods));
router.get('/methods/:id', asyncHandler(contentController.getMethod));
router.get('/pricing', asyncHandler(contentController.getPricing));

export default router;
