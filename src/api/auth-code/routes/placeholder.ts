/**
 * Placeholder content-type: no CRUD routes exposed.
 * Only custom auth routes (auth-code.ts) are used.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter(
  'api::auth-code.placeholder',
  { only: [] }
);
