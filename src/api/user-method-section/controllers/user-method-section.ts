import { factories } from "@strapi/strapi";

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

      const { methodSectionId } = ctx.request.body || {};
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

      const userDocId = (user as any).documentId;
      const methodSectionDocId = (methodSection as any).documentId;

      const existing = await strapi.entityService.findMany(
        "api::user-method-section.user-method-section",
        {
          // фільтруємо по documentId, як у Strapi v5
          filters: {
            user: {
              documentId: userDocId,
            },
            method_section: {
              documentId: methodSectionDocId,
            },
          },
          limit: 1,
        } as any,
      );

      let entryId: number;

      if (existing.length > 0) {
        entryId = (existing[0] as any).id as number;
      } else {
        const created = await strapi.entityService.create(
          "api::user-method-section.user-method-section",
          {
            // використовуємо documentId для connect (Strapi v5)
            data: {
              user: {
                connect: [userDocId],
              },
              method_section: {
                connect: [methodSectionDocId],
              },
              isPaid: false,
            } as any,
          },
        );
        entryId = (created as any).id as number;
      }

      // повертаємо запис з популяцією пов'язаного розділу
      const full = await strapi.entityService.findOne(
        "api::user-method-section.user-method-section",
        entryId,
        {
          populate: {
            method_section: {
              fields: ["id", "slug", "title", "subtitle", "mobtitle"],
            },
          },
        },
      );

      ctx.body = full;
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
