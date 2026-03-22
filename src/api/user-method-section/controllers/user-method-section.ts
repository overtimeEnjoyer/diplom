import { factories } from "@strapi/strapi";
import { createAccessPayment } from "../../payments/services/payments";

export default factories.createCoreController(
  "api::user-method-section.user-method-section",
  ({ strapi }) => ({
    async assign(ctx) {
      // ensure user from JWT (similar to auth-code controller)
      const authCodeController = (strapi as any).controller(
        "api::auth-code.auth-code",
      );
      if (authCodeController?.ensureUserFromJwt) {
        await authCodeController.ensureUserFromJwt(ctx);
      }

      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized();
      }

      const { methodSectionId, categorySlug, methodicSlug } = ctx.request.body || {};
      if (!methodSectionId) {
        return ctx.badRequest("methodSectionId is required");
      }

      const methodSection = await strapi.entityService.findOne(
        "api::method-section.method-section",
        methodSectionId,
        {
          // documentId є завжди як службове поле, його не треба додавати в fields
          fields: ["id", "slug", "title", "subtitle", "mobtitle"],
        },
      );
      if (!methodSection) {
        return ctx.notFound("Method section not found");
      }

      const payment = await createAccessPayment(
        "section",
        {
          id: Number((user as any).id),
          email: (user as any).email || undefined,
        },
        {
          methodSectionId: Number(methodSectionId),
          returnParams: {
            category: typeof categorySlug === "string" ? categorySlug : (methodSection as any).slug,
            methodic: typeof methodicSlug === "string" ? methodicSlug : undefined,
          },
        },
      );

      ctx.body = {
        status: "payment_required",
        access: "section",
        methodSectionId: Number(methodSectionId),
        methodSection: {
          id: (methodSection as any).id,
          slug: (methodSection as any).slug,
          title: (methodSection as any).title,
          subtitle: (methodSection as any).subtitle,
          mobtitle: (methodSection as any).mobtitle,
        },
        ...payment,
      };
    },

    async mySections(ctx) {
      const authCodeController = (strapi as any).controller(
        "api::auth-code.auth-code",
      );
      if (authCodeController?.ensureUserFromJwt) {
        await authCodeController.ensureUserFromJwt(ctx);
      }

      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized();
      }

      const items = await strapi.entityService.findMany(
        "api::user-method-section.user-method-section",
        {
          filters: {
            user: {
              documentId: (user as any).documentId,
            },
          },
          populate: {
            method_section: {
              fields: ["id", "slug", "title", "subtitle", "mobtitle"],
            },
          },
        } as any,
      );

      // Додаємо доступ до МАК-карток у відповідь, щоб фронт не робив окремий /auth/me.
      let makCardsAccess = false;
      try {
        const knex = (strapi as any).db?.connection;
        if (knex) {
          const rows = await knex("up_users")
            .select("mak_cards_access")
            .where("id", (user as any).id)
            .limit(1);
          if (rows[0] && rows[0].mak_cards_access != null) {
            makCardsAccess = !!rows[0].mak_cards_access;
          }
        } else {
          const full = await (strapi as any)
            .query("plugin::users-permissions.user")
            .findOne({
              where: { id: (user as any).id },
            });
          makCardsAccess = full?.makCardsAccess === true;
        }
      } catch {
        // ignore
      }

      ctx.body = { items, makCardsAccess };
    },
  }),
);
