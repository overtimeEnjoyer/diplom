import path from 'path';

/**
 * Database config — Strapi 5 official structure.
 * @see https://docs.strapi.io/dev-docs/configurations/database
 *
 * PostgreSQL (Render):
 *   DATABASE_CLIENT=postgres
 *   DATABASE_URL=<Internal Database URL з Render>
 *   DATABASE_SSL=true
 *   DATABASE_SSL_REJECT_UNAUTHORIZED=false   // для self-signed сертифікатів Render
 *   DATABASE_POOL_MIN=0                      // рекомендовано для Docker/Render
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default ({ env }: { env: any }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  if (client === 'sqlite') {
    const filename = path.join(
      process.cwd(),
      (env('DATABASE_FILENAME', '.tmp/data.db') as string)
    );
    return {
      connection: {
        client: 'sqlite',
        connection: {
          filename,
          readonly: false,
        },
        useNullAsDefault: true,
      },
    };
  }

  // PostgreSQL — офіційний варіант з docs (connectionString + ssl з env)
  const connectionString = (env('DATABASE_URL', '') as string).trim();
  const useSsl = env.bool('DATABASE_SSL', false);
  const sslRejectUnauthorized = env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true);

  const pgConnection: Record<string, unknown> = {
    host: env('DATABASE_HOST', '127.0.0.1'),
    port: env.int('DATABASE_PORT', 5432),
    database: env('DATABASE_NAME', 'strapi'),
    user: env('DATABASE_USERNAME', 'strapi'),
    password: env('DATABASE_PASSWORD', 'strapi'),
    schema: env('DATABASE_SCHEMA', 'public'),
  };

  if (connectionString) {
    pgConnection.connectionString = connectionString;
  }

  // SSL: для Render (self-signed) встанови DATABASE_SSL=true, DATABASE_SSL_REJECT_UNAUTHORIZED=false
  if (useSsl) {
    pgConnection.ssl = { rejectUnauthorized: sslRejectUnauthorized };
  }

  return {
    connection: {
      client: 'postgres',
      connection: pgConnection,
      pool: {
        min: env.int('DATABASE_POOL_MIN', 2),
        max: env.int('DATABASE_POOL_MAX', 10),
      },
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};
