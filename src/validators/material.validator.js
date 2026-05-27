import { body } from 'express-validator';

export const feedbackRules = [
  body('name').isLength({ min: 2 }),
  body('email').isEmail(),
  body('message').isLength({ min: 10 }),
];

export const assignSectionRules = [body('methodSectionId').isInt({ min: 1 })];
