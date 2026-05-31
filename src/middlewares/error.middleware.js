import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { message: 'Not found' } });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details },
      message: err.message,
    });
  }

  if (err.name === 'ValidationError' || err.array) {
    return res.status(400).json({
      error: { message: 'Validation failed', details: err.array?.() || err.errors },
      message: 'Validation failed',
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: { message: 'Resource already exists', code: 'unique_violation' },
      message: 'Resource already exists',
    });
  }

  console.error('[error]', err);

  const dbErrorNames = new Set([
    'SequelizeConnectionError',
    'SequelizeConnectionRefusedError',
    'SequelizeHostNotFoundError',
    'SequelizeConnectionAcquireTimeoutError',
  ]);
  if (dbErrorNames.has(err.name)) {
    return res.status(503).json({
      error: { message: 'Database unavailable', code: 'database_unavailable' },
      message: env.isProduction ? 'Database unavailable' : err.message,
    });
  }

  if (err.name === 'SequelizeDatabaseError' && err.parent?.code === '42P01') {
    return res.status(503).json({
      error: {
        message: 'Database tables missing. Run: DATABASE_URL=... pnpm db:migrate',
        code: 'schema_missing',
      },
      message: 'Database schema missing',
    });
  }

  res.status(500).json({
    error: { message: env.isProduction ? 'Internal server error' : err.message },
    message: env.isProduction ? 'Internal server error' : err.message,
  });
}
