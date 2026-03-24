const rawCorsOrigins = process.env.CORS_ORIGINS || '';
const envCorsOrigins = rawCorsOrigins
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

const corsOrigins =
  envCorsOrigins.length > 0
    ? envCorsOrigins
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://www.rok-mentalhealth.com',
        'https://rok-mentalhealth.com',
      ];

export default [
  'strapi::errors',
  {
    name: 'strapi::cors',
    config: {
      origin: corsOrigins,
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
  },
  'strapi::security',
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];