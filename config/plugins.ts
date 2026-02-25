export default ({ env }) => {
  // SendGrid API (HTTPS) — не потребує порту 587, працює на Render і там, де SMTP блокують
  const sendgridApiKey = env('SENDGRID_API_KEY', env('EMAIL_SMTP_PASS', ''));
  const useSendGridApi = Boolean(sendgridApiKey);

  return {
    email: {
      config: useSendGridApi
        ? {
            provider: 'sendgrid',
            providerOptions: {
              apiKey: sendgridApiKey,
            },
            settings: {
              defaultFrom: env('EMAIL_FROM', 'no-reply@example.com'),
              defaultReplyTo: env('EMAIL_FROM', 'no-reply@example.com'),
            },
          }
        : {
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
  };
};
