import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '../docs/openapi.js';

const swaggerUiOptions = {
  customSiteTitle: 'ROK Mental Health API',
  swaggerOptions: {
    persistAuthorization: true,
  },
};

export function setupSwagger(app) {
  app.get('/api-docs.json', (_req, res) => {
    res.json(openApiSpec);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));
}
