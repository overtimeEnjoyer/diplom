export default ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('EMAIL_SMTP_HOST', 'localhost'),
        port: env.int('EMAIL_SMTP_PORT', 587),
        secure: env.int('EMAIL_SMTP_PORT', 587) === 465,
        auth: {
          user: env('EMAIL_SMTP_USER', ''),
          pass: env('EMAIL_SMTP_PASS', ''),
        },
      },
      settings: {
        defaultFrom: env('EMAIL_FROM', 'no-reply@example.com'),
        defaultReplyTo: env('EMAIL_FROM', 'no-reply@example.com'),
        testAddress: env('EMAIL_FROM', 'no-reply@example.com'),
      },
    },
  },
});
