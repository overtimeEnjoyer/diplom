import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initModels } from './models/index.js';
import { ensureDefaultPricing } from './services/pricing.service.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { normalizeCallbackPayload, parseWayForPayFromRaw } from './utils/wayforpayPayload.js';
import { asyncHandler } from './utils/asyncHandler.js';
import * as paymentsController from './controllers/payments.controller.js';

let appReady;

let dbReady;
let dbInitPromise;

async function initDatabase() {
  if (dbReady) return;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await connectDatabase();
      initModels();
      await ensureDefaultPricing();
      dbReady = true;
    })();
  }
  await dbInitPromise;
}

export async function createApp() {
  if (appReady) return appReady;

  const app = express();
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: env.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    }),
  );
  app.use(helmet({ contentSecurityPolicy: false }));
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.get('/health', (_req, res) =>
    res.json({
      ok: true,
      service: 'rok-m-backend',
      env: env.nodeEnv,
      databaseConfigured: Boolean(env.databaseUrl),
    }),
  );

  app.use(async (req, res, next) => {
    if (req.path === '/health') return next();
    try {
      await initDatabase();
      next();
    } catch (err) {
      next(err);
    }
  });

  // WayForPay callback: preserve raw body before JSON parser
  app.post(
    '/api/payments/wayforpay-callback',
    express.raw({ type: () => true, limit: '2mb' }),
    (req, _res, next) => {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
      req.wayforpayRawBody = raw;
      req.body = { ...normalizeCallbackPayload(req.body), ...(parseWayForPayFromRaw(raw) || {}) };
      next();
    },
    asyncHandler(paymentsController.wayforpayCallback),
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.use('/api', apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  appReady = app;
  return app;
}
