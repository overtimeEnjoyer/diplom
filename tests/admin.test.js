import request from 'supertest';
import { getTestApp, loginAdmin } from './helpers.js';

describe('Admin API', () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it('rejects admin routes without token', async () => {
    const res = await request(app).get('/api/admin/feedbacks');
    expect(res.status).toBe(401);
  });

  it('rejects admin routes for regular user', async () => {
    const login = await request(app).post('/api/auth/local').send({
      identifier: 'test@example.com',
      password: 'password123',
    });
    const res = await request(app)
      .get('/api/admin/feedbacks')
      .set('Authorization', `Bearer ${login.body.jwt}`);
    expect(res.status).toBe(403);
  });

  it('allows admin to list feedbacks', async () => {
    const jwt = await loginAdmin();
    const res = await request(app)
      .get('/api/admin/feedbacks')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('allows admin to get pricing', async () => {
    const jwt = await loginAdmin();
    const res = await request(app)
      .get('/api/admin/pricing')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.data.currency).toBe('UAH');
  });

  it('allows specialist to list methods but not feedbacks', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'specialist@test.local',
      username: 'specialist_user',
      password: 'password123',
    });
    expect([200, 201]).toContain(reg.status);

    const { getModels } = await import('../src/models/index.js');
    const { User, Role } = getModels();
    const specialistRole = await Role.findOne({ where: { type: 'specialist' } });
    await User.update({ roleId: specialistRole.id }, { where: { email: 'specialist@test.local' } });

    const login = await request(app).post('/api/auth/local').send({
      identifier: 'specialist@test.local',
      password: 'password123',
    });
    const jwt = login.body.jwt;

    const methods = await request(app)
      .get('/api/admin/methods')
      .set('Authorization', `Bearer ${jwt}`);
    expect(methods.status).toBe(200);

    const feedbacks = await request(app)
      .get('/api/admin/feedbacks')
      .set('Authorization', `Bearer ${jwt}`);
    expect(feedbacks.status).toBe(403);
  });
});
