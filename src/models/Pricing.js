import { DataTypes, Model } from 'sequelize';

export class Pricing extends Model {}

export function initPricing(sequelize) {
  Pricing.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      documentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'document_id' },
      makCardsPrice: { type: DataTypes.INTEGER, allowNull: false, field: 'mak_cards_price' },
      mediumPrice: { type: DataTypes.INTEGER, allowNull: false, field: 'medium_price' },
      premiumPrice: { type: DataTypes.INTEGER, allowNull: false, field: 'premium_price' },
      sectionPrice: { type: DataTypes.INTEGER, allowNull: false, field: 'section_price' },
      currency: { type: DataTypes.STRING(3), allowNull: false },
    },
    { sequelize, tableName: 'pricings', underscored: true },
  );
  return Pricing;
}
