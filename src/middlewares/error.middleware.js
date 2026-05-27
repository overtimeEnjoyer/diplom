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

  console.error('[error]', err);
  res.status(500).json({
    error: { message: env.isProduction ? 'Internal server error' : err.message },
    message: env.isProduction ? 'Internal server error' : err.message,
  });
}
