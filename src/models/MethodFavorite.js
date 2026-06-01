import { DataTypes, Model } from 'sequelize';

export class MethodFavorite extends Model {}

export function initMethodFavorite(sequelize) {
  MethodFavorite.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
      methodId: { type: DataTypes.INTEGER, allowNull: false, field: 'method_id' },
    },
    {
      sequelize,
      tableName: 'method_favorites',
      underscored: true,
      indexes: [{ unique: true, fields: ['user_id', 'method_id'] }],
    },
  );
  return MethodFavorite;
}
