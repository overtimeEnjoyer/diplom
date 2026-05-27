import request from 'supertest';
import { getTestApp, loginTestUser } from './helpers.js';
import { getModels } from '../src/models/index.js';
import { v4 as uuidv4 } from 'uuid';

describe('Content API', () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
    const { Method, MethodSection } = getModels();
    const section = await MethodSection.findOne({ where: { slug: 'communicate' } });
    await Method.create({
      documentId: uuidv4(),
      slug: 'test-method',
      title: 'Test Method',
      methodSectionId: section.id,
      publishedAt: new Date(),
    });
  });

  it('lists published method sections', async () => {
    const res = await request(app).get('/api/method-sections');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('filters methods by slug', async () => {
    const res = await request(app).get('/api/methods?filters[slug][$eq]=test-method');
    expect(res.status).toBe(200);
    expect(res.body.data[0].slug).toBe('test-method');
  });

  it('returns pricing single type', async () => {
    const res = await request(app).get('/api/pricing');
    expect(res.status).toBe(200);
    expect(res.body.data.currency).toBe('UAH');
    expect(res.body.data.mediumPrice).toBe(3990);
  });
});

describe('MAK favorites', () => {
  let app;
  let jwt;

  beforeAll(async () => {
    app = await getTestApp();
    jwt = await loginTestUser();
  });

  it('toggles mak favorite card', async () => {
    const res = await request(app)
      .post('/api/mak-cards/favorites/toggle')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ cardId: 'card-1' });
    expect(res.status).toBe(200);
    expect(res.body.favoriteCardIds).toContain('card-1');
  });
});
