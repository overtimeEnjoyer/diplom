import request from 'supertest';
import { connectDatabase, getSequelize } from '../src/config/database.js';
import { initModels, getModels } from '../src/models/index.js';
import { createApp } from '../src/app.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

let appInstance;
let dbReady;

export async function getTestApp() {
  if (!dbReady) {
    await connectDatabase();
    initModels();
    await getSequelize().sync({ force: true });
    await seedTestData();
    dbReady = true;
  }
  if (!appInstance) {
    appInstance = await createApp();
  }
  return appInstance;
}

async function seedTestData() {
  const { Role, User, Pricing, MethodSection } = getModels();

  const authRole = await Role.create({ name: 'Authenticated', type: 'authenticated' });
  const adminRole = await Role.create({ name: 'Admin', type: 'admin' });
  await Role.create({ name: 'Specialist', type: 'specialist' });

  await User.create({
    documentId: uuidv4(),
    username: 'testuser',
    email: 'test@example.com',
    password: await bcrypt.hash('password123', 10),
    provider: 'local',
    confirmed: true,
    roleId: authRole.id,
  });

  await Pricing.create({
    documentId: uuidv4(),
    makCardsPrice: 1890,
    mediumPrice: 3990,
    premiumPrice: 4990,
    sectionPrice: 890,
    currency: 'UAH',
  });

  await MethodSection.create({
    documentId: uuidv4(),
    slug: 'communicate',
    title: 'Test Section',
    publishedAt: new Date(),
  });

  await User.create({
    documentId: uuidv4(),
    username: 'admin',
    email: 'admin@test.local',
    password: await bcrypt.hash('adminpass123', 10),
    provider: 'local',
    confirmed: true,
    roleId: adminRole.id,
  });
}

export async function loginAdmin() {
  const app = await getTestApp();
  const res = await request(app).post('/api/auth/local').send({
    identifier: 'admin@test.local',
    password: 'adminpass123',
  });
  return res.body.jwt;
}

export async function loginTestUser() {
  const app = await getTestApp();
  const res = await request(app).post('/api/auth/local').send({
    identifier: 'test@example.com',
    password: 'password123',
  });
  return res.body.jwt;
}
