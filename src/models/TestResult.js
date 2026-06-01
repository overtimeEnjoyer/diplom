import { DataTypes, Model } from 'sequelize';

export class TestResult extends Model {}

export function initTestResult(sequelize) {
  TestResult.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      documentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'document_id' },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
      methodId: { type: DataTypes.INTEGER, allowNull: true, field: 'method_id' },
      testKey: { type: DataTypes.STRING(120), allowNull: false, field: 'test_key' },
      testTitle: { type: DataTypes.STRING(255), field: 'test_title' },
      answers: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      score: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: false, field: 'completed_at' },
    },
    { sequelize, tableName: 'test_results', underscored: true },
  );
  return TestResult;
}
