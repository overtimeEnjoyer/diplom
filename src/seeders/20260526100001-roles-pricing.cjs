'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sequelize = queryInterface.sequelize;

    await sequelize.query(
      `INSERT INTO roles (name, type, description, created_at, updated_at)
       VALUES
         ('Public', 'public', 'Anonymous', :now, :now),
         ('Authenticated', 'authenticated', 'Registered user', :now, :now),
         ('Admin', 'admin', 'Administrator', :now, :now)
       ON CONFLICT (type) DO NOTHING`,
      { replacements: { now } },
    );

    const [pricingRows] = await sequelize.query(`SELECT id FROM pricings LIMIT 1`);
    if (pricingRows.length === 0) {
      await queryInterface.bulkInsert('pricings', [
        {
          document_id: randomUUID(),
          mak_cards_price: 1890,
          medium_price: 3990,
          premium_price: 4990,
          section_price: 890,
          currency: 'UAH',
          created_at: now,
          updated_at: now,
        },
      ]);
      console.log('[seed] Default pricing created');
    } else {
      console.log('[seed] Pricing already exists, skipping');
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('pricings', null, {});
    await queryInterface.bulkDelete('roles', null, {});
  },
};
