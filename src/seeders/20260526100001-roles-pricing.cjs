'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('roles', [
      { name: 'Public', type: 'public', description: 'Anonymous', created_at: now, updated_at: now },
      { name: 'Authenticated', type: 'authenticated', description: 'Registered user', created_at: now, updated_at: now },
      { name: 'Admin', type: 'admin', description: 'Administrator', created_at: now, updated_at: now },
    ]);

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
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('pricings', null, {});
    await queryInterface.bulkDelete('roles', null, {});
  },
};
