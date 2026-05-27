import request from 'supertest';
import { getTestApp, loginTestUser } from './helpers.js';

describe('User sections API', () => {
  let app;
  let jwt;

  beforeAll(async () => {
    app = await getTestApp();
    jwt = await loginTestUser();
  });

  it('requires auth for user-method-sections/me', async () => {
    const res = await request(app).get('/api/user-method-sections/me');
    expect(res.status).toBe(401);
  });

  it('returns my sections for authenticated user', async () => {
    const res = await request(app)
      .get('/api/user-method-sections/me')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.makCardsAccess).toBe('boolean');
  });

  it('submits feedback without auth', async () => {
    const res = await request(app).post('/api/feedback').send({
      name: 'Test User',
      email: 'feedback@example.com',
      message: 'This is a long enough feedback message.',
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
