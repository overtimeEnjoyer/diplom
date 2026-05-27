import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { getTestApp, loginTestUser } from './helpers.js';
import { getModels } from '../src/models/index.js';

describe('Progress / view history API', () => {
  let app;
  let jwt;
  let methodId;

  beforeAll(async () => {
    app = await getTestApp();
    jwt = await loginTestUser();
    const { Method, MethodSection } = getModels();
    let section = await MethodSection.findOne({ where: { slug: 'communicate' } });
    if (!section) {
      section = await MethodSection.create({
        documentId: uuidv4(),
        slug: 'communicate',
        title: 'Test',
        publishedAt: new Date(),
      });
    }
    let method = await Method.findOne({ where: { slug: 'test-method-progress' } });
    if (!method) {
      method = await Method.create({
        documentId: uuidv4(),
        slug: 'test-method-progress',
        title: 'Progress Test Method',
        methodSectionId: section.id,
        publishedAt: new Date(),
      });
    }
    methodId = method.id;
  });

  it('records a material view', async () => {
    const res = await request(app)
      .post(`/api/progress/methods/${methodId}/view`)
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('lists view history', async () => {
    const res = await request(app)
      .get('/api/progress/me')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
