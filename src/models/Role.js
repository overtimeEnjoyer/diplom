import { DataTypes, Model } from 'sequelize';

export class Role extends Model {}

export function initRole(sequelize) {
  Role.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      type: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(255) },
    },
    { sequelize, tableName: 'roles', underscored: true },
  );
  return Role;
}
