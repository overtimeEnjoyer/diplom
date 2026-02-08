import type { Core } from '@strapi/strapi';

const config: Core.RouterConfig = {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/auth/register',
      handler: 'api::auth-code.auth-code.register',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/email/request-code',
      handler: 'api::auth-code.auth-code.requestEmailCode',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/email/verify-code',
      handler: 'api::auth-code.auth-code.verifyCode',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/password/request-code',
      handler: 'api::auth-code.auth-code.requestPasswordCode',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/password/reset',
      handler: 'api::auth-code.auth-code.resetPassword',
      config: { auth: false },
    },
  ],
};

export default config;
