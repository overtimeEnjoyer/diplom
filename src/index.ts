import { ensureDefaultPricing } from "./api/pricing/pricing-settings";
import { applyPaidAccess, cleanupBrokenUserMethodSectionRows, revokeAllMethodicsAccess } from "./api/payments/services/payments";

declare const strapi: any;

function hasTruthyTariffFlag(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  return (
    data.isPremium === true ||
    data.isMedium === true ||
    data.makCardsAccess === true ||
    data.is_premium === true ||
    data.is_medium === true ||
    data.mak_cards_access === true
  );
}

function hasTariffFieldInPayload(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  return (
    Object.prototype.hasOwnProperty.call(data, "isPremium") ||
    Object.prototype.hasOwnProperty.call(data, "isMedium") ||
    Object.prototype.hasOwnProperty.call(data, "makCardsAccess") ||
    Object.prototype.hasOwnProperty.call(data, "is_premium") ||
    Object.prototype.hasOwnProperty.call(data, "is_medium") ||
    Object.prototype.hasOwnProperty.call(data, "mak_cards_access")
  );
}

export default {
  register() {},

  async bootstrap() {
    try {
      await ensureDefaultPricing();
    } catch (error) {
      strapi.log.warn(
        `[pricing] failed to seed defaults: ${String((error as Error)?.message || error)}`,
      );
    }

    const inProgress = new Set<number>();

    strapi.db.lifecycles.subscribe({
      models: ["plugin::users-permissions.user"],
      async afterCreate(event: any) {
        const userId = Number(event?.result?.id);
        if (!Number.isFinite(userId) || userId <= 0) return;

        const createdData = (event?.params?.data || {}) as Record<string, unknown>;
        if (!hasTruthyTariffFlag(createdData)) return;
        if (inProgress.has(userId)) return;

        inProgress.add(userId);
        try {
          await cleanupBrokenUserMethodSectionRows();

          const user = await strapi.query("plugin::users-permissions.user").findOne({
            where: { id: userId },
          });
          if (!user) return;

          if ((user as any).isPremium === true) {
            await applyPaidAccess("premium", userId);
            return;
          }
          if ((user as any).isMedium === true) {
            await applyPaidAccess("medium", userId);
            return;
          }
          if ((user as any).makCardsAccess === true) {
            await applyPaidAccess("mak-cards", userId);
          }
        } catch (error) {
          strapi.log.error(
            `[users-lifecycle] failed to sync access after create userId=${userId}: ${String((error as Error)?.message || error)}`,
          );
        } finally {
          inProgress.delete(userId);
        }
      },
      async afterUpdate(event: any) {
        const userId = Number(event?.result?.id);
        if (!Number.isFinite(userId) || userId <= 0) return;

        const updateData = (event?.params?.data || {}) as Record<string, unknown>;
        if (!hasTariffFieldInPayload(updateData) && !hasTruthyTariffFlag(updateData)) return;
        if (inProgress.has(userId)) return;

        inProgress.add(userId);
        try {
          const user = await strapi.query("plugin::users-permissions.user").findOne({
            where: { id: userId },
          });
          if (!user) return;

          const isPremium = (user as any).isPremium === true || (user as any).is_premium === true;
          const isMedium = (user as any).isMedium === true || (user as any).is_medium === true;
          const makCardsAccess = (user as any).makCardsAccess === true || (user as any).mak_cards_access === true;

          if (isPremium) {
            await applyPaidAccess("premium", userId, { skipUserFlagUpdate: true });
            return;
          }
          if (isMedium) {
            await applyPaidAccess("medium", userId, { skipUserFlagUpdate: true });
            return;
          }
          if (!isPremium && !isMedium) {
            await revokeAllMethodicsAccess(userId);
            return;
          }
          if (makCardsAccess) {
            await applyPaidAccess("mak-cards", userId, { skipUserFlagUpdate: true });
          }
        } catch (error) {
          strapi.log.error(
            `[users-lifecycle] failed to sync access after update userId=${userId}: ${String((error as Error)?.message || error)}`,
          );
        } finally {
          inProgress.delete(userId);
        }
      },
    });
  },
};