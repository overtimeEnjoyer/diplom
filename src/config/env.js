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
  mfaTokenExpiresIn: process.env.MFA_TOKEN_EXPIRES_IN || '10m',
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseReadReplicaUrls: (process.env.DATABASE_READ_REPLICA_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Supabase Auth (optional BaaS delegation)
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'media',

  // WayForPay
  wayforpayMerchantSecret: process.env.WAYFORPAY_MERCHANT_SECRET || '',

  // Presigned uploads: supabase | s3
  uploadProvider: (process.env.UPLOAD_PROVIDER || 'supabase').toLowerCase(),
  s3Bucket: process.env.AWS_S3_BUCKET || '',
  s3Region: process.env.AWS_S3_REGION || '',
  s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',

  // Catalog cache: Redis (optional) or in-memory per instance
  redisUrl: process.env.REDIS_URL || '',

  // Cache TTL for read-heavy catalog (ms)
  contentCacheTtlMs: Number(process.env.CONTENT_CACHE_TTL_MS || 60_000),

  externalFetchTimeoutMs: Number(process.env.EXTERNAL_FETCH_TIMEOUT_MS || 15_000),

  // Rate limits
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
};
