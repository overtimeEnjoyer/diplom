require('dotenv').config();

const base = {
  dialect: 'postgres',
  logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
  migrationStorageTableName: 'sequelize_migrations',
};

module.exports = {
  development: {
    ...base,
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'rok_m_dev',
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  },
  test: {
    ...base,
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'rok_m_test',
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  },
  production: {
    ...base,
    url: process.env.DATABASE_URL,
    dialectOptions: process.env.DATABASE_SSL === 'true'
      ? { ssl: { require: true, rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } }
      : {},
    pool: {
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      min: Number(process.env.DATABASE_POOL_MIN || 0),
      acquire: Number(process.env.DATABASE_CONNECTION_TIMEOUT || 30000),
      idle: 10000,
    },
  },
};
