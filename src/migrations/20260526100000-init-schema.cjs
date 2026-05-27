'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(80), allowNull: false },
      type: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      description: { type: Sequelize.STRING(255) },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      document_id: { type: Sequelize.UUID, allowNull: false, unique: true },
      username: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      password: { type: Sequelize.STRING(255), allowNull: false },
      provider: { type: Sequelize.STRING(40), defaultValue: 'local' },
      confirmed: { type: Sequelize.BOOLEAN, defaultValue: true },
      blocked: { type: Sequelize.BOOLEAN, defaultValue: false },
      role_id: {
        type: Sequelize.INTEGER,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      email_confirmation_code: { type: Sequelize.STRING(128) },
      email_confirmation_expires: { type: Sequelize.DATE },
      password_reset_code: { type: Sequelize.STRING(128) },
      password_reset_expires: { type: Sequelize.DATE },
      mak_cards_access: { type: Sequelize.BOOLEAN, defaultValue: false },
      is_medium: { type: Sequelize.BOOLEAN, defaultValue: false },
      is_premium: { type: Sequelize.BOOLEAN, defaultValue: false },
      mak_favorite_card_ids: { type: Sequelize.JSONB, defaultValue: null },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['username']);
    await queryInterface.addIndex('users', ['role_id']);

    await queryInterface.createTable('method_sections', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      document_id: { type: Sequelize.UUID, allowNull: false, unique: true },
      slug: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      title: { type: Sequelize.TEXT },
      subtitle: { type: Sequelize.TEXT },
      mobtitle: { type: Sequelize.TEXT },
      published_at: { type: Sequelize.DATE },
      locale: { type: Sequelize.STRING(10), defaultValue: null },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('method_sections', ['slug']);
    await queryInterface.addIndex('method_sections', ['published_at']);

    await queryInterface.createTable('methods', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      document_id: { type: Sequelize.UUID, allowNull: false, unique: true },
      method_section_id: {
        type: Sequelize.INTEGER,
        references: { model: 'method_sections', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      title: { type: Sequelize.TEXT },
      slug: { type: Sequelize.STRING(160), unique: true },
      author_source: { type: Sequelize.TEXT },
      approach: { type: Sequelize.TEXT },
      target_audience: { type: Sequelize.TEXT },
      goal: { type: Sequelize.TEXT },
      purpose: { type: Sequelize.JSONB },
      therapeutic_effect: { type: Sequelize.JSONB },
      time: { type: Sequelize.TEXT },
      materials: { type: Sequelize.TEXT },
      short_instruction: { type: Sequelize.JSONB },
      instruction: { type: Sequelize.JSONB },
      interpretation: { type: Sequelize.JSONB },
      completion: { type: Sequelize.JSONB },
      reflection_questions: { type: Sequelize.JSONB },
      published_at: { type: Sequelize.DATE },
      locale: { type: Sequelize.STRING(10), defaultValue: null },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('methods', ['slug']);
    await queryInterface.addIndex('methods', ['method_section_id']);
    await queryInterface.addIndex('methods', ['published_at']);

    await queryInterface.createTable('user_method_sections', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      document_id: { type: Sequelize.UUID, allowNull: false, unique: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      method_section_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'method_sections', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      is_paid: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('user_method_sections', ['user_id']);
    await queryInterface.addIndex('user_method_sections', ['method_section_id']);
    await queryInterface.addIndex('user_method_sections', ['user_id', 'method_section_id'], {
      unique: true,
      name: 'user_method_sections_user_section_unique',
    });

    await queryInterface.createTable('pricings', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      document_id: { type: Sequelize.UUID, allowNull: false, unique: true },
      mak_cards_price: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1890 },
      medium_price: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3990 },
      premium_price: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 4990 },
      section_price: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 890 },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'UAH' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('feedbacks', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      document_id: { type: Sequelize.UUID, allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      email: { type: Sequelize.STRING(255), allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      tariff: { type: Sequelize.STRING(120) },
      is_processed: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('feedbacks', ['is_processed']);
    await queryInterface.addIndex('feedbacks', ['email']);

    await queryInterface.createTable('material_views', {
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
      viewed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('material_views', ['user_id', 'method_id']);
    await queryInterface.addIndex('material_views', ['viewed_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('material_views');
    await queryInterface.dropTable('feedbacks');
    await queryInterface.dropTable('pricings');
    await queryInterface.dropTable('user_method_sections');
    await queryInterface.dropTable('methods');
    await queryInterface.dropTable('method_sections');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('roles');
  },
};
