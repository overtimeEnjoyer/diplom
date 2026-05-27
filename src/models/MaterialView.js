import { DataTypes, Model } from 'sequelize';

/** View history / progress tracking for educational materials. */
export class MaterialView extends Model {}

export function initMaterialView(sequelize) {
  MaterialView.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
      methodId: { type: DataTypes.INTEGER, allowNull: false, field: 'method_id' },
      viewedAt: { type: DataTypes.DATE, allowNull: false, field: 'viewed_at' },
    },
    { sequelize, tableName: 'material_views', underscored: true },
  );
  return MaterialView;
}
