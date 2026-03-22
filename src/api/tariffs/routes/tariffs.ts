export default {
  routes: [
    {
      method: "POST",
      path: "/tariffs/medium/activate",
      handler: "tariffs.activateMedium",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/tariffs/premium/activate",
      handler: "tariffs.activatePremium",
      config: {
        auth: false,
      },
    },
  ],
};

