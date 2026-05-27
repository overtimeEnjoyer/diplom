import { DataTypes, Model } from 'sequelize';

/** Educational material (maps to thesis "Material"). */
export class Method extends Model {}

export function initMethod(sequelize) {
  Method.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      documentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'document_id' },
      methodSectionId: { type: DataTypes.INTEGER, field: 'method_section_id' },
      title: { type: DataTypes.TEXT },
      slug: { type: DataTypes.STRING(160), unique: true },
      authorSource: { type: DataTypes.TEXT, field: 'author_source' },
      approach: { type: DataTypes.TEXT },
      targetAudience: { type: DataTypes.TEXT, field: 'target_audience' },
      goal: { type: DataTypes.TEXT },
      purpose: { type: DataTypes.JSONB },
      therapeuticEffect: { type: DataTypes.JSONB, field: 'therapeutic_effect' },
      time: { type: DataTypes.TEXT },
      materials: { type: DataTypes.TEXT },
      shortInstruction: { type: DataTypes.JSONB, field: 'short_instruction' },
      instruction: { type: DataTypes.JSONB },
      interpretation: { type: DataTypes.JSONB },
      completion: { type: DataTypes.JSONB },
      reflectionQuestions: { type: DataTypes.JSONB, field: 'reflection_questions' },
      publishedAt: { type: DataTypes.DATE, field: 'published_at' },
      locale: { type: DataTypes.STRING(10) },
    },
    { sequelize, tableName: 'methods', underscored: true },
  );
  return Method;
}
