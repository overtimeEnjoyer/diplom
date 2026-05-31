import { body } from 'express-validator';

export const setFavoritesRules = [
  body('favoriteCardIds').isArray().withMessage('favoriteCardIds must be an array'),
];

export const toggleFavoriteRules = [
  body('cardId').isString().trim().notEmpty().withMessage('cardId must be a non-empty string'),
];
