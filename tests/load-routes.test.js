import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { connectDatabase, getSequelize } from '../src/config/database.js';
import { initModels } from '../src/models/index.js';
import { createApp, __resetAppCacheForTests } from '../src/app.js';

describe('Load test routes', () => {
  let app;
  let prevFlag;

  beforeAll(async () => {
    prevFlag = process.env.ENABLE_LOAD_TEST_ROUTES;
    process.env.ENABLE_LOAD_TEST_ROUTES = 'true';
    __resetAppCacheForTests();
    await connectDatabase();
    initModels();
    app = await createApp();
  });

  afterAll(async () => {
    process.env.ENABLE_LOAD_TEST_ROUTES = prevFlag;
    __resetAppCacheForTests();
    await getSequelize().close();
  });

  it('exposes CPU probe', async () => {
    const res = await request(app).get('/load-test/cpu');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('exposes memory probe', async () => {
    const res = await request(app).get('/load-test/memory');
    expect(res.status).toBe(200);
    expect(res.body.bytes).toBeGreaterThan(0);
  });

  it('simulates 500 for metrics', async () => {
    const res = await request(app).get('/load-test/simulate-error');
    expect(res.status).toBe(500);
  });
});
