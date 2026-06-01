import { Router } from 'express';
import authRoutes from './auth.routes.js';
import makCardsRoutes from './makCards.routes.js';
import paymentsRoutes from './payments.routes.js';
import tariffsRoutes from './tariffs.routes.js';
import userMethodSectionRoutes from './userMethodSection.routes.js';
import contentRoutes from './content.routes.js';
import feedbackRoutes from './feedback.routes.js';
import progressRoutes from './progress.routes.js';
import adminRoutes from './admin.routes.js';
import contentAliasRoutes from './contentAlias.routes.js';
import userAliasRoutes from './userAlias.routes.js';
import uploadsRoutes from './uploads.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/content', contentAliasRoutes);
router.use('/user', userAliasRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/mak-cards', makCardsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/tariffs', tariffsRoutes);
router.use('/user-method-sections', userMethodSectionRoutes);
router.use('/', contentRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/progress', progressRoutes);
router.use('/admin', adminRoutes);

export default router;
