import { getSequelize } from '../config/database.js';
import { initRole, Role } from './Role.js';
import { initUser, User } from './User.js';
import { initMethodSection, MethodSection } from './MethodSection.js';
import { initMethod, Method } from './Method.js';
import { initUserMethodSection, UserMethodSection } from './UserMethodSection.js';
import { initPricing, Pricing } from './Pricing.js';
import { initFeedback, Feedback } from './Feedback.js';
import { initMaterialView, MaterialView } from './MaterialView.js';
import { initTestResult, TestResult } from './TestResult.js';

let modelsInitialized = false;

export function initModels(sequelize = getSequelize()) {
  if (modelsInitialized && sequelize === getSequelize()) {
    return getModels();
  }

  initRole(sequelize);
  initUser(sequelize);
  initMethodSection(sequelize);
  initMethod(sequelize);
  initUserMethodSection(sequelize);
  initPricing(sequelize);
  initFeedback(sequelize);
  initMaterialView(sequelize);
  initTestResult(sequelize);

  Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
  User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

  MethodSection.hasMany(Method, { foreignKey: 'method_section_id', as: 'methods' });
  Method.belongsTo(MethodSection, { foreignKey: 'method_section_id', as: 'method_section' });

  User.hasMany(UserMethodSection, { foreignKey: 'user_id', as: 'userMethodSections' });
  UserMethodSection.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  MethodSection.hasMany(UserMethodSection, { foreignKey: 'method_section_id', as: 'userMethodSections' });
  UserMethodSection.belongsTo(MethodSection, { foreignKey: 'method_section_id', as: 'method_section' });

  User.hasMany(MaterialView, { foreignKey: 'user_id', as: 'materialViews' });
  MaterialView.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Method.hasMany(MaterialView, { foreignKey: 'method_id', as: 'materialViews' });
  MaterialView.belongsTo(Method, { foreignKey: 'method_id', as: 'method' });

  User.hasMany(TestResult, { foreignKey: 'user_id', as: 'testResults' });
  TestResult.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Method.hasMany(TestResult, { foreignKey: 'method_id', as: 'testResults' });
  TestResult.belongsTo(Method, { foreignKey: 'method_id', as: 'method' });

  modelsInitialized = true;
  return getModels();
}

export function getModels() {
  return {
    Role,
    User,
    MethodSection,
    Method,
    UserMethodSection,
    Pricing,
    Feedback,
    MaterialView,
    TestResult,
    sequelize: getSequelize(),
  };
}
