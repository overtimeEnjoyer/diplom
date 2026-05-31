import request from 'supertest';
import { getTestApp, loginTestUser } from './helpers.js';
import { getModels } from '../src/models/index.js';

describe('Payments API', () => {
  let app;
  let jwt;

  beforeAll(async () => {
    app = await getTestApp();
    jwt = await loginTestUser();
  });

  it('returns payment_required when activating medium tariff', async () => {
    const res = await request(app)
      .post('/api/tariffs/medium/activate')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('payment_required');
    expect(res.body.payment_required).toBe(true);
    expect(res.body.payment).toMatchObject({
      provider: 'mock',
      type: 'medium',
      status: 'pending',
      currency: 'UAH',
    });
    expect(res.body.payment.orderReference).toMatch(/^RKM\|medium\|/);
    expect(res.body.orderReference).toBe(res.body.payment.orderReference);
  });

  it('confirms mock payment and grants medium access', async () => {
    const start = await request(app)
      .post('/api/tariffs/medium/activate')
      .set('Authorization', `Bearer ${jwt}`);
    const { orderReference } = start.body.payment;

    const confirm = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ orderReference });
    expect(confirm.status).toBe(200);
    expect(confirm.body.paid).toBe(true);

    const status = await request(app).get(`/api/payments/status?orderReference=${encodeURIComponent(orderReference)}`);
    expect(status.body.paid).toBe(true);

    const { User } = getModels();
    const user = await User.unscoped().findOne({ where: { email: 'test@example.com' } });
    expect(user.isMedium).toBe(true);
  });

  it('rejects confirm without orderReference', async () => {
    const res = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects confirm without auth', async () => {
    const res = await request(app).post('/api/payments/confirm').send({ orderReference: 'RKM|medium|1|0|x' });
    expect(res.status).toBe(401);
  });
});
