import { body } from 'express-validator';

export const feedbackRules = [
  body('name').isLength({ min: 2 }).withMessage('Name is required (min 2 characters)'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').isLength({ min: 10 }).withMessage('Message is required (min 10 characters)'),
];
