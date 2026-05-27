import request from 'supertest';
import { getTestApp } from './helpers.js';

describe('Auth API', () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it('registers a new user and returns JWT', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'newuser@example.com',
      username: 'newuser',
      password: 'secret12',
    });
    expect(res.status).toBe(200);
    expect(res.body.jwt).toBeDefined();
    expect(res.body.user.email).toBe('newuser@example.com');
  });

  it('rejects invalid registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'bad',
      username: 'x',
      password: '123',
    });
    expect(res.status).toBe(400);
  });

  it('logs in with identifier and password', async () => {
    const res = await request(app).post('/api/auth/local').send({
      identifier: 'test@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.jwt).toBeDefined();
  });

  it('returns 401 for /auth/me without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns profile for authenticated user', async () => {
    const login = await request(app).post('/api/auth/local').send({
      identifier: 'test@example.com',
      password: 'password123',
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@example.com');
    expect(Array.isArray(res.body.makFavoriteCardIds)).toBe(true);
  });
});
