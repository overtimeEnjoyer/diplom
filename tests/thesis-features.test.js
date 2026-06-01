import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { getTestApp, loginTestUser } from './helpers.js';

describe('Thesis features', () => {
  let app;
  let jwt;

  beforeAll(async () => {
    app = await getTestApp();
    jwt = await loginTestUser();
  });

  it('GET /api/methods/search requires q', async () => {
    const res = await request(app).get('/api/methods/search');
    expect(res.status).toBe(400);
  });

  it('GET /api/content/sections mirrors method-sections', async () => {
    const res = await request(app).get('/api/content/sections');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('POST /api/progress/tests saves result', async () => {
    const res = await request(app)
      .post('/api/progress/tests')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        testKey: 'demo-quiz',
        testTitle: 'Demo',
        answers: { q1: 'a' },
        score: 10,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.testKey).toBe('demo-quiz');
  });

  it('GET /api/progress/tests/me lists results', async () => {
    const res = await request(app)
      .get('/api/progress/tests/me')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/auth/mfa/enable toggles MFA', async () => {
    const res = await request(app)
      .post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.mfaEnabled).toBe(true);
  });

  it('POST /api/uploads/presign without storage config returns 500', async () => {
    const res = await request(app)
      .post('/api/uploads/presign')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ filename: 'video.mp4', contentType: 'video/mp4' });
    expect([500, 503]).toContain(res.status);
  });
});
