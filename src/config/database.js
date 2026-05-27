import { Sequelize } from 'sequelize';
import { env } from './env.js';

let sequelizeInstance;
let readReplicas = [];

const poolConfig = {
  max: Number(process.env.DATABASE_POOL_MAX || 5),
  min: Number(process.env.DATABASE_POOL_MIN || 0),
  acquire: Number(process.env.DATABASE_CONNECTION_TIMEOUT || 30000),
  idle: 10000,
};

const dialectOptions =
  process.env.DATABASE_SSL === 'true'
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      }
    : {};

const modelDefaults = { underscored: true, timestamps: true };

function buildSequelize(urlOrConfig) {
  const readUrls = env.databaseReadReplicaUrls;
  const writeUrl = typeof urlOrConfig === 'string' ? urlOrConfig : env.databaseUrl;

  if (writeUrl && readUrls.length > 0) {
    return new Sequelize({
      dialect: 'postgres',
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
      logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
      dialectOptions,
      pool: poolConfig,
      define: modelDefaults,
    });
  }

  return new Sequelize({
    dialect: 'postgres',
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'rok_m_dev',
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
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
  const sequelize = getSequelize();
  await sequelize.authenticate();
  return sequelize;
}
