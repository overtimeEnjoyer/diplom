import { body } from 'express-validator';

export const assignSectionRules = [body('methodSectionId').isInt({ min: 1 })];
