export default {
  routes: [
    {
      method: "GET",
      path: "/payments/status",
      handler: "payments.paymentStatus",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/payments/wayforpay-callback",
      handler: "payments.wayforpayCallback",
      config: {
        auth: false,
      },
    },
  ],
};
