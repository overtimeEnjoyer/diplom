import path from 'path';

export default ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  if (client === 'sqlite') {
    const filename = path.join(process.cwd(), env('DATABASE_FILENAME', '.tmp/data.db'));
    return {
      connection: {
        client: 'sqlite',
        connection: {
          filename,
          // Явно відкривати з правами на запис (уникаємо SQLITE_READONLY на деяких системах)
          readonly: false,
        },
        useNullAsDefault: true,
      },
    };
  }

  // PostgreSQL
  let connectionString = env('DATABASE_URL');
  if (!connectionString) {
    const host = env('DATABASE_HOST', 'localhost');
    const port = env.int('DATABASE_PORT', 5432);
    const db = env('DATABASE_NAME', 'strapi');
    const user = env('DATABASE_USERNAME', 'postgres');
    const pass = env('DATABASE_PASSWORD', '');
    connectionString = `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${db}`;
  }
  const isRemote = connectionString && !connectionString.includes('localhost');

  // Для Render/хмарного Postgres: приймаємо self-signed сертифікат (rejectUnauthorized: false)
  const pgConnection = isRemote
    ? {
        connectionString,
        ssl: { rejectUnauthorized: false },
      }
    : { connectionString };

  return {
    connection: {
      client: 'postgres',
      connection: pgConnection,
      pool: { min: 0, max: 10 },
      acquireConnectionTimeout: 90000,
    },
  };
};
