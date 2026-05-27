'use strict';

const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const email = (process.env.ADMIN_EMAIL || 'admin@rok-mentalhealth.local').toLowerCase();
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'Admin123!ChangeMe';
    const now = new Date();

    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE type = 'admin' LIMIT 1`,
    );
    const adminRoleId = roles[0]?.id;
    if (!adminRoleId) {
      throw new Error('Admin role not found. Run roles-pricing seeder first.');
    }

    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = :email OR username = :username LIMIT 1`,
      { replacements: { email, username } },
    );
    if (existing.length > 0) {
      console.log(`[seed] Admin user already exists (${email}), skipping`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await queryInterface.bulkInsert('users', [
      {
        document_id: randomUUID(),
        username,
        email,
        password: hashedPassword,
        provider: 'local',
        confirmed: true,
        blocked: false,
        role_id: adminRoleId,
        mak_cards_access: false,
        is_medium: false,
        is_premium: false,
        mak_favorite_card_ids: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    console.log(`[seed] Admin user created: ${email} (username: ${username})`);
    if (!process.env.ADMIN_PASSWORD) {
      console.warn('[seed] Default password: Admin123!ChangeMe — set ADMIN_PASSWORD in .env');
    }
  },

  async down(queryInterface) {
    const email = (process.env.ADMIN_EMAIL || 'admin@rok-mentalhealth.local').toLowerCase();
    await queryInterface.bulkDelete('users', { email }, {});
  },
};
