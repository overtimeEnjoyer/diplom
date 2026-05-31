import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { validateEnv } from './config/validateEnv.js';
import { connectDatabase, getSequelize } from './config/database.js';
import { getModels, initModels } from './models/index.js';
import { ensureDefaultPricing } from './services/pricing.service.js';
import apiRoutes from './routes/index.js';
import { setupSwagger } from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { asyncHandler } from './utils/asyncHandler.js';

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

  validateEnv();

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
      dbCheck: '/health/db',
      docs: '/api-docs',
    }),
  );

  app.get(
    '/health/db',
    asyncHandler(async (_req, res) => {
      try {
        await initDatabase();
        await getSequelize().query('SELECT 1 AS ok');
        const { Pricing } = getModels();
        const count = await Pricing.count();
        res.json({ ok: true, database: 'connected', pricings: count });
      } catch (err) {
        console.error('[health/db]', err);
        res.status(503).json({
          ok: false,
          database: 'error',
          message: err.message,
        });
      }
    }),
  );

  setupSwagger(app);

  if (process.env.ENABLE_LOAD_TEST_ROUTES === 'true') {
    app.get('/load-test/cpu', (_req, res) => {
      let acc = 0;
      for (let i = 0; i < 8_000_000; i += 1) acc += i % 13;
      res.json({ ok: true, acc });
    });
    app.get('/load-test/memory', (_req, res) => {
      const chunks = Array.from({ length: 8 }, () => Buffer.alloc(256 * 1024));
      res.json({ ok: true, bytes: chunks.reduce((n, b) => n + b.length, 0) });
    });
    app.get('/load-test/simulate-error', () => {
      throw new Error('Load test simulated error (ENABLE_LOAD_TEST_ROUTES)');
    });
  }

  app.get('/', (_req, res) =>
    res.json({
      ok: true,
      service: 'rok-m-backend',
      health: '/health',
      docs: '/api-docs',
      openApi: '/api-docs.json',
      api: {
        pricing: '/api/pricing',
        methodSections: '/api/method-sections',
      },
    }),
  );

  app.use(async (req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    try {
      await initDatabase();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.use('/api', apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  appReady = app;
  return app;
}

/** @internal test-only — reset singleton between suites with different env flags */
export function __resetAppCacheForTests() {
  appReady = undefined;
  dbReady = false;
  dbInitPromise = undefined;
}
