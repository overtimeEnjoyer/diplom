import crypto from "crypto";

declare const strapi: any;

export type AccessKind = "mak-cards" | "medium" | "premium" | "section";

type PaymentConfig = {
  merchantAccount: string;
  merchantDomainName: string;
  merchantSecretKey: string;
  returnUrl: string;
  serviceUrl: string;
};

const PRICE_BY_ACCESS: Record<AccessKind, number> = {
  "mak-cards": 1,
  medium: 1,
  premium: 1,
  section: 1,
};

const CURRENCY = "UAH";
const WFP_PAY_OFFLINE_URL = "https://secure.wayforpay.com/pay?behavior=offline";
const WFP_PAY_FALLBACK_URL = "https://secure.wayforpay.com/pay";

function requirePaymentConfig(): PaymentConfig {
  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || "";
  const merchantDomainName = process.env.WAYFORPAY_MERCHANT_DOMAIN_NAME || "";
  const merchantSecretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY || "";
  const returnUrl = process.env.WAYFORPAY_RETURN_URL || "";
  const serviceUrl = process.env.WAYFORPAY_SERVICE_URL || "";

  if (!merchantAccount || !merchantDomainName || !merchantSecretKey || !returnUrl || !serviceUrl) {
    throw new Error("WAYFORPAY env config is incomplete");
  }

  return { merchantAccount, merchantDomainName, merchantSecretKey, returnUrl, serviceUrl };
}

function signHmacMd5(source: string, secret: string): string {
  return crypto.createHmac("md5", secret).update(source, "utf8").digest("hex");
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function productLabel(kind: AccessKind): string {
  if (kind === "mak-cards") return "MAK cards access";
  if (kind === "medium") return "Tariff Medium";
  if (kind === "section") return "Method section access";
  return "Tariff Premium";
}

function returnKind(kind: AccessKind): "mak" | "medium" | "premium" | "section" {
  if (kind === "mak-cards") return "mak";
  return kind;
}

function withReturnParams(
  baseUrl: string,
  kind: AccessKind,
  extraParams?: { category?: string; methodic?: string },
): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  let url = `${baseUrl}${separator}kind=${encodeURIComponent(returnKind(kind))}`;
  if (extraParams?.category) {
    url += `&category=${encodeURIComponent(extraParams.category)}`;
  }
  if (extraParams?.methodic) {
    url += `&methodic=${encodeURIComponent(extraParams.methodic)}`;
  }
  return url;
}

function buildOrderReference(kind: AccessKind, userId: number, methodSectionId?: number): string {
  const random = Math.random().toString(36).slice(2, 8);
  if (kind === "section") return `RKM|section|${userId}|${methodSectionId || 0}|${Date.now()}|${random}`;
  return `RKM|${kind}|${userId}|${Date.now()}|${random}`;
}

export function parseOrderReference(orderReference: string): { kind: AccessKind; userId: number; methodSectionId?: number } | null {
  if (orderReference.startsWith("wp_")) {
    const mUser = orderReference.match(/^wp_(\d+)_/);
    const userId = mUser ? Number(mUser[1]) : NaN;
    if (!Number.isFinite(userId) || userId <= 0) return null;

    if (orderReference.includes("_tariff_medium_")) return { kind: "medium", userId };
    if (orderReference.includes("_tariff_premium_")) return { kind: "premium", userId };
    if (orderReference.includes("_mak_cards_") || orderReference.includes("_mak-cards_") || orderReference.includes("_mak_")) {
      return { kind: "mak-cards", userId };
    }
    // Legacy section references may not include methodSectionId, so they cannot be mapped reliably.
    return null;
  }

  const parts = orderReference.split("|");
  if (parts[0] !== "RKM") return null;

  const maybeKind = parts[1] as AccessKind;
  const userId = Number(parts[2]);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  if (maybeKind !== "mak-cards" && maybeKind !== "medium" && maybeKind !== "premium" && maybeKind !== "section") return null;

  if (maybeKind === "section") {
    if (parts.length < 6) return null;
    const methodSectionId = Number(parts[3]);
    if (!Number.isFinite(methodSectionId) || methodSectionId <= 0) return null;
    return { kind: maybeKind, userId, methodSectionId };
  }

  if (parts.length < 5) return null;

  return { kind: maybeKind, userId };
}

export function verifyWayForPayCallbackSignature(payload: Record<string, any>): boolean {
  const { merchantSecretKey } = requirePaymentConfig();
  const provided = String(payload.merchantSignature ?? "").trim().toLowerCase();
  if (!provided) return false;

  const merchantAccount = String(payload.merchantAccount ?? "");
  const orderReference = String(payload.orderReference ?? "");
  const amountRaw = payload.amount;
  const currency = String(payload.currency ?? "");
  const authCode = String(payload.authCode ?? "");
  const cardPan = String(payload.cardPan ?? "");
  const transactionStatus = String(payload.transactionStatus ?? "");
  const reasonCodeRaw = payload.reasonCode;

  // WayForPay callbacks can represent numeric fields differently (e.g. "1", "1.00", 1).
  // We accept equivalent variants to avoid false negative signature validation.
  const amountVariants = new Set<string>();
  amountVariants.add(String(amountRaw ?? ""));
  const amountAsNumber = Number(amountRaw);
  if (Number.isFinite(amountAsNumber)) {
    amountVariants.add(amountAsNumber.toString());
    amountVariants.add(amountAsNumber.toFixed(2));
  }

  const reasonCodeVariants = new Set<string>();
  reasonCodeVariants.add(String(reasonCodeRaw ?? ""));
  const reasonAsNumber = Number(reasonCodeRaw);
  if (Number.isFinite(reasonAsNumber)) {
    reasonCodeVariants.add(reasonAsNumber.toString());
  }

  for (const amount of amountVariants) {
    for (const reasonCode of reasonCodeVariants) {
      const source = [merchantAccount, orderReference, amount, currency, authCode, cardPan, transactionStatus, reasonCode].join(";");
      const expected = signHmacMd5(source, merchantSecretKey).toLowerCase();
      if (provided === expected) return true;
    }
  }

  return false;
}

export function buildWayForPayCallbackAck(orderReference: string): { orderReference: string; status: "accept"; time: number; signature: string } {
  const { merchantSecretKey } = requirePaymentConfig();
  const time = nowSec();
  const status = "accept";
  const signature = signHmacMd5(`${orderReference};${status};${time}`, merchantSecretKey);
  return { orderReference, status, time, signature };
}

export async function createAccessPayment(
  kind: AccessKind,
  user: { id: number; email?: string | null },
  options?: { methodSectionId?: number; returnParams?: { category?: string; methodic?: string } },
): Promise<{
  kind: AccessKind;
  orderReference: string;
  amount: number;
  currency: string;
  paymentUrl: string;
  paymentData?: Record<string, any>;
}> {
  const config = requirePaymentConfig();
  const amount = PRICE_BY_ACCESS[kind];
  const orderReference = buildOrderReference(kind, user.id, options?.methodSectionId);
  const orderDate = nowSec();
  const name = productLabel(kind);
  const count = 1;

  const signSource = [
    config.merchantAccount,
    config.merchantDomainName,
    orderReference,
    orderDate,
    amount,
    CURRENCY,
    name,
    count,
    amount,
  ].join(";");

  const merchantSignature = signHmacMd5(signSource, config.merchantSecretKey);

  const paymentData: Record<string, any> = {
    transactionType: "CREATE_INVOICE",
    merchantAccount: config.merchantAccount,
    merchantDomainName: config.merchantDomainName,
    merchantAuthType: "SimpleSignature",
    merchantSignature,
    apiVersion: 1,
    language: "UA",
    returnUrl: withReturnParams(config.returnUrl, kind, options?.returnParams),
    serviceUrl: config.serviceUrl,
    orderReference,
    orderDate,
    amount,
    currency: CURRENCY,
    productName: [name],
    productPrice: [amount],
    productCount: [count],
    clientEmail: user.email || undefined,
    orderTimeout: 3600,
  };

  try {
    const response = await fetch(WFP_PAY_OFFLINE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentData),
    });

    if (response.ok) {
      const data = (await response.json()) as { url?: string };
      if (data?.url && typeof data.url === "string") {
        return { kind, orderReference, amount, currency: CURRENCY, paymentUrl: data.url };
      }
    }
  } catch {
    // Fallback to standard pay URL with form data for the frontend.
  }

  return {
    kind,
    orderReference,
    amount,
    currency: CURRENCY,
    paymentUrl: WFP_PAY_FALLBACK_URL,
    paymentData,
  };
}

async function grantMediumAccess(userId: number, userDocId: string): Promise<void> {
  const knex = strapi.db?.connection;
  if (knex) {
    try {
      await knex("up_users").where("id", userId).update({ is_medium: true });
    } catch {
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: userId },
        data: { isMedium: true },
      });
    }
  } else {
    await strapi.query("plugin::users-permissions.user").update({
      where: { id: userId },
      data: { isMedium: true },
    });
  }

  const allMethodSections = await strapi.entityService.findMany("api::method-section.method-section", {
    fields: ["id", "slug"],
  } as any);
  const methodSectionDocIds = (allMethodSections as any[]).map((ms) => ms?.documentId).filter((x) => typeof x === "string");
  if (methodSectionDocIds.length === 0) return;

  const existing = await strapi.entityService.findMany("api::user-method-section.user-method-section", {
    filters: { user: { documentId: userDocId } },
    populate: { method_section: { fields: ["documentId"] } },
  } as any);

  const existingByMethodDocId = new Map<string, { entryId: number; isPaid: boolean }>();
  for (const x of existing as any[]) {
    const docId = x?.method_section?.documentId;
    if (typeof docId !== "string") continue;
    existingByMethodDocId.set(docId, { entryId: x.id as number, isPaid: x.isPaid === true });
  }

  for (const methodSectionDocId of methodSectionDocIds) {
    const existingEntry = existingByMethodDocId.get(methodSectionDocId);
    if (existingEntry) {
      if (!existingEntry.isPaid) {
        await strapi.entityService.update("api::user-method-section.user-method-section", existingEntry.entryId, {
          data: { isPaid: true } as any,
        });
      }
      continue;
    }

    await strapi.entityService.create("api::user-method-section.user-method-section", {
      data: {
        user: { connect: [userDocId] },
        method_section: { connect: [methodSectionDocId] },
        isPaid: true,
      } as any,
    });
  }
}

async function grantPremiumAccess(userId: number, userDocId: string): Promise<void> {
  const knex = strapi.db?.connection;
  if (knex) {
    try {
      await knex("up_users").where("id", userId).update({ mak_cards_access: true, is_premium: true });
    } catch {
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: userId },
        data: { makCardsAccess: true, isPremium: true } as any,
      });
    }
  } else {
    await strapi.query("plugin::users-permissions.user").update({
      where: { id: userId },
      data: { makCardsAccess: true, isPremium: true } as any,
    });
  }

  await grantMediumAccess(userId, userDocId);
}

async function grantMakCardsAccess(userId: number): Promise<void> {
  const knex = strapi.db?.connection;
  if (knex) {
    try {
      await knex("up_users").where("id", userId).update({ mak_cards_access: true });
    } catch {
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: userId },
        data: { makCardsAccess: true },
      });
    }
  } else {
    await strapi.query("plugin::users-permissions.user").update({
      where: { id: userId },
      data: { makCardsAccess: true },
    });
  }
}

async function grantSingleSectionAccess(userId: number, methodSectionId: number): Promise<void> {
  const user = await strapi.query("plugin::users-permissions.user").findOne({ where: { id: userId } });
  if (!user) return;
  const userDocId = (user as any).documentId as string | undefined;
  if (!userDocId) return;

  const methodSection = await strapi.entityService.findOne("api::method-section.method-section", methodSectionId, {
    fields: ["id", "slug", "title"],
  } as any);
  if (!methodSection) return;
  const methodSectionDocId = (methodSection as any).documentId as string | undefined;
  if (!methodSectionDocId) return;

  const existing = await strapi.entityService.findMany("api::user-method-section.user-method-section", {
    filters: {
      user: { documentId: userDocId },
      method_section: { documentId: methodSectionDocId },
    },
    limit: 1,
  } as any);

  if (existing.length > 0) {
    const existingEntry = existing[0] as any;
    if (existingEntry.isPaid !== true) {
      await strapi.entityService.update("api::user-method-section.user-method-section", existingEntry.id, {
        data: { isPaid: true } as any,
      });
    }
    return;
  }

  await strapi.entityService.create("api::user-method-section.user-method-section", {
    data: {
      user: { connect: [userDocId] },
      method_section: { connect: [methodSectionDocId] },
      isPaid: true,
    } as any,
  });
}

export async function applyPaidAccess(kind: AccessKind, userId: number): Promise<void> {
  const user = await strapi.query("plugin::users-permissions.user").findOne({ where: { id: userId } });
  if (!user) return;
  const userDocId = (user as any).documentId as string | undefined;

  if (kind === "mak-cards") {
    await grantMakCardsAccess(userId);
    return;
  }

  if (!userDocId) return;
  if (kind === "medium") {
    await grantMediumAccess(userId, userDocId);
    return;
  }
  if (kind === "section") {
    return;
  }
  await grantPremiumAccess(userId, userDocId);
}

export async function applyPaidSectionAccess(userId: number, methodSectionId: number): Promise<void> {
  await grantSingleSectionAccess(userId, methodSectionId);
}

export function isSuccessTransactionStatus(status: string): boolean {
  return status === "Approved";
}

export function expectedPrice(kind: AccessKind): number {
  return PRICE_BY_ACCESS[kind];
}

export function expectedCurrency(): string {
  return CURRENCY;
}

export async function checkAccessStatus(kind: AccessKind, userId: number, methodSectionId?: number): Promise<boolean> {
  const user = await strapi.query("plugin::users-permissions.user").findOne({ where: { id: userId } });
  if (!user) return false;

  if (kind === "mak-cards") {
    const knex = strapi.db?.connection;
    if (knex) {
      try {
        const rows = await knex("up_users").select("mak_cards_access").where("id", userId).limit(1);
        return rows[0]?.mak_cards_access === true;
      } catch {
        return (user as any).makCardsAccess === true;
      }
    }
    return (user as any).makCardsAccess === true;
  }

  if (kind === "medium") {
    const knex = strapi.db?.connection;
    if (knex) {
      try {
        const rows = await knex("up_users").select("is_medium").where("id", userId).limit(1);
        return rows[0]?.is_medium === true;
      } catch {
        return (user as any).isMedium === true;
      }
    }
    return (user as any).isMedium === true;
  }

  if (kind === "premium") {
    const knex = strapi.db?.connection;
    if (knex) {
      try {
        const rows = await knex("up_users").select("is_premium").where("id", userId).limit(1);
        return rows[0]?.is_premium === true;
      } catch {
        return (user as any).isPremium === true;
      }
    }
    return (user as any).isPremium === true;
  }

  if (!methodSectionId) return false;
  const userDocId = (user as any).documentId as string | undefined;
  if (!userDocId) return false;

  const methodSection = await strapi.entityService.findOne("api::method-section.method-section", methodSectionId, {
    fields: ["id", "slug"],
  } as any);
  if (!methodSection) return false;
  const methodSectionDocId = (methodSection as any).documentId as string | undefined;
  if (!methodSectionDocId) return false;

  const existing = await strapi.entityService.findMany("api::user-method-section.user-method-section", {
    filters: {
      user: { documentId: userDocId },
      method_section: { documentId: methodSectionDocId },
      isPaid: true,
    },
    limit: 1,
  } as any);

  return existing.length > 0;
}
