import { DataTypes, Model } from 'sequelize';

export class Feedback extends Model {}

export function initFeedback(sequelize) {
  Feedback.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      documentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'document_id' },
      name: { type: DataTypes.STRING(255), allowNull: false },
      email: { type: DataTypes.STRING(255), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      tariff: { type: DataTypes.STRING(120) },
      isProcessed: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_processed' },
    },
    { sequelize, tableName: 'feedbacks', underscored: true },
  );
  return Feedback;
}
