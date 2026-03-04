export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/register',
      handler: 'auth-code.register',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/email/request-code',
      handler: 'auth-code.requestEmailCode',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/email/verify-code',
      handler: 'auth-code.verifyCode',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/password/request-code',
      handler: 'auth-code.requestPasswordCode',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/password/reset',
      handler: 'auth-code.resetPassword',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/auth/me',
      handler: 'auth-code.me',
      config: {
        auth: false, // JWT checked inside controller to avoid content-api 403
      },
    },
    {
      method: 'PUT',
      path: '/auth/profile',
      handler: 'auth-code.updateMe',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/profile',
      handler: 'auth-code.updateMe',
      config: {
        auth: false,
      },
    },
  ],
};
