'use strict';

async function columnExists(queryInterface, table, column) {
  const rows = await queryInterface.sequelize.query(
    `
    SELECT 1 AS found
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = :table AND column_name = :column
    LIMIT 1
    `,
    { replacements: { table, column }, type: queryInterface.sequelize.QueryTypes.SELECT },
  );
  return rows.length > 0;
}

async function tableExists(queryInterface, table) {
  const rows = await queryInterface.sequelize.query(
    `
    SELECT 1 AS found
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = :table
    LIMIT 1
    `,
    { replacements: { table }, type: queryInterface.sequelize.QueryTypes.SELECT },
  );
  return rows.length > 0;
}

async function indexExists(queryInterface, indexName) {
  const rows = await queryInterface.sequelize.query(
    `
    SELECT 1 AS found FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = :indexName
    LIMIT 1
    `,
    { replacements: { indexName }, type: queryInterface.sequelize.QueryTypes.SELECT },
  );
  return rows.length > 0;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    if (!(await columnExists(queryInterface, 'users', 'supabase_uid'))) {
      await queryInterface.addColumn('users', 'supabase_uid', {
        type: Sequelize.UUID,
        allowNull: true,
        unique: true,
      });
    }
    if (!(await columnExists(queryInterface, 'users', 'mfa_enabled'))) {
      await queryInterface.addColumn('users', 'mfa_enabled', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!(await columnExists(queryInterface, 'users', 'mfa_secret'))) {
      await queryInterface.addColumn('users', 'mfa_secret', {
        type: Sequelize.STRING(128),
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'users', 'mfa_login_code'))) {
      await queryInterface.addColumn('users', 'mfa_login_code', {
        type: Sequelize.STRING(128),
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'users', 'mfa_login_expires'))) {
      await queryInterface.addColumn('users', 'mfa_login_expires', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(
      `INSERT INTO roles (name, type, description, created_at, updated_at)
       VALUES ('Specialist', 'specialist', 'Content specialist / therapist', :now, :now)
       ON CONFLICT (type) DO NOTHING`,
      { replacements: { now } },
    );

    if (!(await tableExists(queryInterface, 'test_results'))) {
      await queryInterface.createTable('test_results', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        document_id: { type: Sequelize.UUID, allowNull: false, unique: true },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        method_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'methods', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        test_key: { type: Sequelize.STRING(120), allowNull: false },
        test_title: { type: Sequelize.STRING(255), allowNull: true },
        answers: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: Sequelize.literal("'{}'::jsonb"),
        },
        score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        completed_at: { type: Sequelize.DATE, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex('test_results', ['user_id', 'completed_at']);
      await queryInterface.addIndex('test_results', ['method_id']);
    }

    if (!(await indexExists(queryInterface, 'methods_fts_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX methods_fts_idx ON methods
        USING gin (
          to_tsvector(
            'simple',
            coalesce(title, '') || ' ' ||
            coalesce(approach, '') || ' ' ||
            coalesce(target_audience, '') || ' ' ||
            coalesce(short_instruction::text, '')
          )
        )
      `);
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS methods_fts_idx');
    await queryInterface.dropTable('test_results');
    if (await columnExists(queryInterface, 'users', 'mfa_login_expires')) {
      await queryInterface.removeColumn('users', 'mfa_login_expires');
    }
    if (await columnExists(queryInterface, 'users', 'mfa_login_code')) {
      await queryInterface.removeColumn('users', 'mfa_login_code');
    }
    if (await columnExists(queryInterface, 'users', 'mfa_secret')) {
      await queryInterface.removeColumn('users', 'mfa_secret');
    }
    if (await columnExists(queryInterface, 'users', 'mfa_enabled')) {
      await queryInterface.removeColumn('users', 'mfa_enabled');
    }
    if (await columnExists(queryInterface, 'users', 'supabase_uid')) {
      await queryInterface.removeColumn('users', 'supabase_uid');
    }
    await queryInterface.bulkDelete('roles', { type: 'specialist' });
  },
};
