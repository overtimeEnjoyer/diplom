export default {
  routes: [
    {
      method: 'POST',
      path: '/user-method-sections/assign',
      handler: 'user-method-section.assign',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/user-method-sections/me',
      handler: 'user-method-section.mySections',
      config: {
        auth: false,
      },
    },
  ],
};

