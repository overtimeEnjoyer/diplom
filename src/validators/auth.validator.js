import { body } from 'express-validator';

export const registerRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const loginRules = [
  body('identifier').notEmpty().withMessage('Identifier is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const resetPasswordRules = [
  body('email').isEmail(),
  body('code').notEmpty(),
  body('password').isLength({ min: 6 }),
];

export const emailOnlyRules = [body('email').isEmail().withMessage('Valid email is required')];

export const emailCodeRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('code').isLength({ min: 4, max: 12 }).withMessage('Valid code is required'),
];
