import { Sequelize } from 'sequelize';
import pg from 'pg';
import pgHstore from 'pg-hstore';
import { env } from './env.js';

void pgHstore;

let sequelizeInstance;
let readReplicas = [];

function inferSslFromUrl(url) {
  if (!url) return false;
  return /sslmode=require|ssl=true|neon\.tech|supabase\.co|vercel-storage\.com|render\.com|railway\.app/i.test(
    url,
  );
}

function useSsl(url) {
  if (process.env.DATABASE_SSL === 'true') return true;
  // `DATABASE_SSL=false` is for local Postgres only; Neon/Supabase URLs still need SSL.
  if (process.env.DATABASE_SSL === 'false') return inferSslFromUrl(url);
  return inferSslFromUrl(url);
}

const poolConfig = {
  max: Number(
    process.env.DATABASE_POOL_MAX || (process.env.VERCEL ? 1 : 5),
  ),
  min: Number(process.env.DATABASE_POOL_MIN || 0),
  acquire: Number(process.env.DATABASE_CONNECTION_TIMEOUT || 30000),
  idle: Number(process.env.DATABASE_POOL_IDLE || 5000),
};

function buildDialectOptions(url) {
  if (!useSsl(url)) return {};
  return {
    ssl: {
      require: true,
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
  };
}

const modelDefaults = { underscored: true, timestamps: true };

function buildSequelize(urlOrConfig) {
  const readUrls = env.databaseReadReplicaUrls;
  const writeUrl = typeof urlOrConfig === 'string' ? urlOrConfig : env.databaseUrl;
  const dialectOptions = buildDialectOptions(writeUrl);

  if (writeUrl && readUrls.length > 0) {
    return new Sequelize({
      dialect: 'postgres',
      dialectModule: pg,
      logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
      dialectOptions,
      pool: poolConfig,
      define: modelDefaults,
      replication: {
        read: readUrls.map((url) => ({ url })),
        write: { url: writeUrl },
      },
    });
  }

  if (typeof urlOrConfig === 'string' && urlOrConfig) {
    return new Sequelize(urlOrConfig, {
      dialect: 'postgres',
      dialectModule: pg,
      logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
      dialectOptions,
      pool: poolConfig,
      define: modelDefaults,
    });
  }

  return new Sequelize({
    dialect: 'postgres',
    dialectModule: pg,
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'rok_m_dev',
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
    dialectOptions: buildDialectOptions(''),
    pool: poolConfig,
    define: modelDefaults,
  });
}

/** Singleton Sequelize for serverless — reuse connection across warm invocations. */
export function getSequelize() {
  if (!sequelizeInstance) {
    sequelizeInstance = env.databaseUrl
      ? buildSequelize(env.databaseUrl)
      : buildSequelize();
  }
  return sequelizeInstance;
}

export function hasReadReplicas() {
  return env.databaseReadReplicaUrls.length > 0;
}

/** Read pool for raw SQL (FTS); falls back to primary when replicas are not configured. */
export function getCatalogSequelize() {
  return hasReadReplicas() ? getReadSequelize() : getSequelize();
}

/** Optional read replicas for read-heavy queries (round-robin). */
export function getReadSequelize() {
  if (env.databaseReadReplicaUrls.length === 0) {
    return getSequelize();
  }
  if (readReplicas.length === 0) {
    readReplicas = env.databaseReadReplicaUrls.map((url) => buildSequelize(url));
  }
  const idx = Math.floor(Math.random() * readReplicas.length);
  return readReplicas[idx];
}

export async function connectDatabase() {
  if (env.isProduction && !env.databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables (use Neon/Supabase pooler URL).',
    );
  }

  const sequelize = getSequelize();
  try {
    await sequelize.authenticate();
  } catch (err) {
    const hint = env.databaseUrl
      ? 'Check DATABASE_URL, SSL (Neon needs sslmode=require or DATABASE_SSL=true), and that migrations were run.'
      : 'Set DATABASE_URL to your hosted PostgreSQL connection string.';
    err.message = `${err.message}. ${hint}`;
    throw err;
  }
  return sequelize;
}
