import { DataTypes, Model } from 'sequelize';

/** Educational category / section (maps to thesis "Category"). */
export class MethodSection extends Model {}

export function initMethodSection(sequelize) {
  MethodSection.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      documentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'document_id' },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      title: { type: DataTypes.TEXT },
      subtitle: { type: DataTypes.TEXT },
      mobtitle: { type: DataTypes.TEXT },
      publishedAt: { type: DataTypes.DATE, field: 'published_at' },
      locale: { type: DataTypes.STRING(10) },
    },
    { sequelize, tableName: 'method_sections', underscored: true },
  );
  return MethodSection;
}
