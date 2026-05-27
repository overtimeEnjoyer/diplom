import { DataTypes, Model } from 'sequelize';

export class User extends Model {}

export function initUser(sequelize) {
  User.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      documentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'document_id' },
      username: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      provider: { type: DataTypes.STRING(40), defaultValue: 'local' },
      confirmed: { type: DataTypes.BOOLEAN, defaultValue: true },
      blocked: { type: DataTypes.BOOLEAN, defaultValue: false },
      roleId: { type: DataTypes.INTEGER, field: 'role_id' },
      emailConfirmationCode: { type: DataTypes.STRING(128), field: 'email_confirmation_code' },
      emailConfirmationExpires: { type: DataTypes.DATE, field: 'email_confirmation_expires' },
      passwordResetCode: { type: DataTypes.STRING(128), field: 'password_reset_code' },
      passwordResetExpires: { type: DataTypes.DATE, field: 'password_reset_expires' },
      makCardsAccess: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'mak_cards_access' },
      isMedium: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_medium' },
      isPremium: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_premium' },
      makFavoriteCardIds: { type: DataTypes.JSONB, field: 'mak_favorite_card_ids' },
    },
    {
      sequelize,
      tableName: 'users',
      underscored: true,
      defaultScope: {
        attributes: { exclude: ['password', 'emailConfirmationCode', 'passwordResetCode'] },
      },
      scopes: {
        withSecrets: { attributes: { include: ['password', 'emailConfirmationCode', 'passwordResetCode'] } },
      },
    },
  );
  return User;
}
