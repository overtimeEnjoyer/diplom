'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('method_favorites')) {
    await queryInterface.createTable('method_favorites', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      method_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'methods', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('method_favorites', ['user_id', 'method_id'], {
      unique: true,
      name: 'method_favorites_user_method_unique',
    });
    await queryInterface.addIndex('method_favorites', ['user_id']);
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS material_views_viewed_at_brin
      ON material_views USING brin (viewed_at)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS material_views_viewed_at_brin');
    await queryInterface.dropTable('method_favorites');
  },
};
