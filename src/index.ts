import { applyPaidAccess } from "./api/payments/services/payments";

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

export default {
  register() {},

  async bootstrap() {
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
        if (!hasTruthyTariffFlag(updateData)) return;
        if (inProgress.has(userId)) return;

        inProgress.add(userId);
        try {
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
            `[users-lifecycle] failed to sync access after update userId=${userId}: ${String((error as Error)?.message || error)}`,
          );
        } finally {
          inProgress.delete(userId);
        }
      },
    });
  },
};