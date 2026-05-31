import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { getTestApp } from './helpers.js';

describe('Swagger', () => {
  it('serves OpenAPI JSON', async () => {
    const app = await getTestApp();
    const res = await request(app).get('/api-docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/auth/local']).toBeDefined();
    expect(res.body.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it('serves Swagger UI', async () => {
    const app = await getTestApp();
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
