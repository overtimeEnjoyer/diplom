import dotenv from 'dotenv';

dotenv.config();

function parseOrigins(raw) {
  if (!raw) {
    return [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://www.rok-mentalhealth.com',
      'https://rok-mentalhealth.com',
    ];
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseReadReplicaUrls: (process.env.DATABASE_READ_REPLICA_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};
