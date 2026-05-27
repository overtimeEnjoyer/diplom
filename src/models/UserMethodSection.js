import { DataTypes, Model } from 'sequelize';

export class UserMethodSection extends Model {}

export function initUserMethodSection(sequelize) {
  UserMethodSection.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      documentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'document_id' },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
      methodSectionId: { type: DataTypes.INTEGER, allowNull: false, field: 'method_section_id' },
      isPaid: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_paid' },
    },
    { sequelize, tableName: 'user_method_sections', underscored: true },
  );
  return UserMethodSection;
}
