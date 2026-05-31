import { body } from 'express-validator';

export const confirmPaymentRules = [
  body('orderReference').isString().trim().notEmpty().withMessage('orderReference is required'),
];
