import { createAccessPayment } from "../../payments/services/payments";

declare const strapi: any;

export default {
  async activateMedium(ctx: any) {
    const authCodeController = (strapi as any).controller("api::auth-code.auth-code");
    if (authCodeController?.ensureUserFromJwt) await authCodeController.ensureUserFromJwt(ctx);

    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const payment = await createAccessPayment("medium", {
      id: Number((user as any).id),
      email: (user as any).email || undefined,
    });

    ctx.body = {
      status: "payment_required",
      access: "medium",
      ...payment,
    };
  },

  async activatePremium(ctx: any) {
    const authCodeController = (strapi as any).controller("api::auth-code.auth-code");
    if (authCodeController?.ensureUserFromJwt) await authCodeController.ensureUserFromJwt(ctx);

    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const payment = await createAccessPayment("premium", {
      id: Number((user as any).id),
      email: (user as any).email || undefined,
    });

    ctx.body = {
      status: "payment_required",
      access: "premium",
      ...payment,
    };
  },
};

