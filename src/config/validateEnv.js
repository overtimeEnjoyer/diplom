import { env } from './env.js';

const DEV_JWT_SECRET = 'dev-secret-change-me';

/** Fail fast on misconfiguration before accepting traffic. */
export function validateEnv() {
  if (env.isTest) return;

  if (env.isProduction) {
    if (!env.databaseUrl) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (!process.env.JWT_SECRET || env.jwtSecret === DEV_JWT_SECRET) {
      throw new Error('JWT_SECRET must be set to a strong random value in production');
    }
  }
}
