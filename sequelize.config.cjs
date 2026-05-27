require('dotenv').config();

const base = {
  dialect: 'postgres',
  logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
  migrationStorageTableName: 'sequelize_migrations',
};

function useSsl(url) {
  if (!url) return false;
  if (/sslmode=disable/i.test(url)) return false;
  if (/sslmode=require|sslmode=verify/i.test(url)) return true;
  if (/neon\.tech|supabase\.co|vercel-storage\.com|render\.com|railway\.app/i.test(url)) {
    return true;
  }
  try {
    const host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return false;
  } catch {
    /* ignore */
  }
  if (process.env.DATABASE_SSL === 'true') return true;
  if (process.env.DATABASE_SSL === 'false') return false;
  return false;
}

function buildEnv(databaseName, extra = {}) {
  const url = process.env.DATABASE_URL;
  const config = { ...base, ...extra };

  if (url) {
    config.url = url;
    if (useSsl(url)) {
      config.dialectOptions = {
        ssl: {
          require: true,
          rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      };
    }
    return config;
  }

  config.host = process.env.DATABASE_HOST || '127.0.0.1';
  config.port = Number(process.env.DATABASE_PORT || 5432);
  config.database = databaseName;
  config.username = process.env.DATABASE_USERNAME || 'postgres';
  config.password = process.env.DATABASE_PASSWORD || 'postgres';
  return config;
}

module.exports = {
  development: buildEnv(process.env.DATABASE_NAME || 'rok_m_dev'),
  test: buildEnv(process.env.DATABASE_NAME || 'rok_m_test'),
  production: buildEnv(process.env.DATABASE_NAME || 'rok_m_dev', {
      pool: {
        max: Number(process.env.DATABASE_POOL_MAX || 5),
        min: Number(process.env.DATABASE_POOL_MIN || 0),
        acquire: Number(process.env.DATABASE_CONNECTION_TIMEOUT || 30000),
        idle: 10000,
      },
    }),
};
