import pg from 'pg';
import pgHstore from 'pg-hstore';

// Ensure Vercel serverless bundle includes Postgres drivers (pnpm + @vercel/nft)
void pg;
void pgHstore;

import { createApp } from '../src/app.js';

let handler;
let startupError;

function sendJson(res, status, body) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/** Wait until Express finishes the response (required on Vercel serverless). */
function runExpress(app, req, res) {
  return new Promise((resolve, reject) => {
    const finish = () => resolve();
    res.once('finish', finish);
    res.once('close', finish);
    res.once('error', reject);

    try {
      app(req, res, (err) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export default async function vercelHandler(req, res) {
  try {
    if (!handler) {
      if (startupError) {
        return sendJson(res, 503, {
          ok: false,
          error: 'service_unavailable',
          message: startupError.message,
        });
      }
      handler = await createApp();
    }
    await runExpress(handler, req, res);
  } catch (err) {
    startupError = err;
    console.error('[vercel] handler error:', err);
    if (!res.headersSent) {
      return sendJson(res, 503, {
        ok: false,
        error: 'service_unavailable',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Service failed to start. Check Vercel logs and DATABASE_URL.'
            : err.message,
      });
    }
  }
}
