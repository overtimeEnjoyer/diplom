import crypto from "crypto";

declare const strapi: any;

export type AccessKind = "mak-cards" | "medium" | "premium" | "section";

type PaymentConfig = {
  merchantAccount: string;
  merchantDomainName: string;
  merchantSecretKey: string;
  merchantPassword?: string;
  returnUrl: string;
  serviceUrl: string;
};

const PRICE_BY_ACCESS: Record<AccessKind, number> = {
  "mak-cards": 1890,
  medium: 3990,
  premium: 4490,
  section: 1890,
};

const CURRENCY = "UAH";
const WFP_PAY_OFFLINE_URL = "https://secure.wayforpay.com/pay?behavior=offline";
const WFP_PAY_FALLBACK_URL = "https://secure.wayforpay.com/pay";

function requirePaymentConfig(): PaymentConfig {
  const merchantAccount = (process.env.WAYFORPAY_MERCHANT_ACCOUNT || "").trim();
  const merchantDomainName = (process.env.WAYFORPAY_MERCHANT_DOMAIN_NAME || "").trim();
  const merchantSecretKey = (process.env.WAYFORPAY_MERCHANT_SECRET_KEY || "").trim();
  const merchantPassword = (process.env.WAYFORPAY_MERCHANT_PASSWORD || "").trim();
  const returnUrl = (process.env.WAYFORPAY_RETURN_URL || "").trim();
  const serviceUrl = (process.env.WAYFORPAY_SERVICE_URL || "").trim();

  if (!merchantAccount || !merchantDomainName || !merchantSecretKey || !returnUrl || !serviceUrl) {
    throw new Error("WAYFORPAY env config is incomplete");
  }

  return { merchantAccount, merchantDomainName, merchantSecretKey, merchantPassword, returnUrl, serviceUrl };
}

function signHmacMd5(source: string, secret: string): string {
  return crypto.createHmac("md5", secret).update(source, "utf8").digest("hex");
}

function fingerprint(value: string): string {
  if (!value) return "empty";
  return crypto.createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

function valueVariants(raw: unknown): string[] {
  const variants = new Set<string>();
  const base = String(raw ?? "");
  variants.add(base);
  variants.add(base.trim());
  if (base === "") {
    variants.add("null");
    variants.add("undefined");
  }
  return Array.from(variants);
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
  const { merchantSecretKey, merchantPassword, merchantDomainName } = requirePaymentConfig();
  const provided = String(payload.merchantSignature ?? "").trim().toLowerCase();
  if (!provided) return false;
  const keysToTry = [merchantSecretKey, merchantPassword].filter((k): k is string => typeof k === "string" && k.length > 0);

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

  const makeExpected = (parts: string[], key: string): string => signHmacMd5(parts.join(";"), key).toLowerCase();
  const authCodeVariants = valueVariants(payload.authCode);
  const cardPanVariants = valueVariants(payload.cardPan);
  const txStatusVariants = valueVariants(payload.transactionStatus);
  const parsedRef = parseOrderReference(orderReference);
  const refParts = orderReference.split("|");
  const refTimestampMsRaw =
    refParts.find((p) => /^\d{12,}$/.test(p)) ||
    "";
  const refTimestampSec = refTimestampMsRaw ? Math.floor(Number(refTimestampMsRaw) / 1000) : NaN;

  for (const key of keysToTry) {
    for (const amount of amountVariants) {
      for (const reasonCode of reasonCodeVariants) {
        // Some invoice callbacks come with reduced field set.
        const expectedShort = makeExpected([merchantAccount, orderReference, amount, currency], key);
        if (provided === expectedShort) return true;

        for (const ac of authCodeVariants) {
          // Invoice callback minimal format with authCode.
          const expectedInvoiceWithAuth = makeExpected([merchantAccount, orderReference, amount, currency, ac], key);
          if (provided === expectedInvoiceWithAuth) return true;

          // Some WayForPay flows return signature equal to CREATE_INVOICE request signature.
          if (parsedRef && Number.isFinite(refTimestampSec) && refTimestampSec > 0) {
            const name = productLabel(parsedRef.kind);
            const expectedCreateInvoice = makeExpected(
              [merchantAccount, merchantDomainName, orderReference, String(refTimestampSec), amount, currency, name, "1", amount],
              key,
            );
            if (provided === expectedCreateInvoice) return true;
          }

          for (const cp of cardPanVariants) {
            for (const tx of txStatusVariants) {
              // Standard transaction callback signature format.
              const expectedFull = makeExpected([merchantAccount, orderReference, amount, currency, ac, cp, tx, reasonCode], key);
              if (provided === expectedFull) return true;
            }
          }
        }
      }
    }
  }

  return false;
}

export function getWayForPaySignatureDebug(payload: Record<string, any>): {
  providedPrefix: string;
  provided: string;
  expectedPrefixes: string[];
  candidates: Array<{
    keyKind: "secret" | "password";
    variant: "short" | "invoiceWithAuth" | "full" | "createInvoiceRequest";
    source: string;
    expectedPrefix: string;
  }>;
  merchantAccountFromCallback: string;
  merchantAccountFromEnv: string;
  keyFingerprints: { secret: string; password: string };
  fields: {
    orderReference: string;
    amountRaw: string;
    currency: string;
    authCode: string;
    cardPan: string;
    transactionStatus: string;
    reasonCodeRaw: string;
  };
} {
  const { merchantSecretKey, merchantPassword, merchantDomainName, merchantAccount: merchantAccountFromEnv } = requirePaymentConfig();
  const provided = String(payload.merchantSignature ?? "").trim().toLowerCase();
  const keysToTry = [
    { keyKind: "secret" as const, key: merchantSecretKey },
    { keyKind: "password" as const, key: merchantPassword || "" },
  ].filter((x) => x.key.length > 0);
  const merchantAccountFromCallback = String(payload.merchantAccount ?? "");
  const orderReference = String(payload.orderReference ?? "");
  const amountRaw = String(payload.amount ?? "");
  const currency = String(payload.currency ?? "");
  const authCode = String(payload.authCode ?? "");
  const cardPan = String(payload.cardPan ?? "");
  const transactionStatus = String(payload.transactionStatus ?? "");
  const reasonCodeRaw = String(payload.reasonCode ?? "");

  const amountVariants = new Set<string>();
  amountVariants.add(amountRaw);
  const amountAsNumber = Number(payload.amount);
  if (Number.isFinite(amountAsNumber)) {
    amountVariants.add(amountAsNumber.toString());
    amountVariants.add(amountAsNumber.toFixed(2));
  }

  const reasonCodeVariants = new Set<string>();
  reasonCodeVariants.add(reasonCodeRaw);
  const reasonAsNumber = Number(payload.reasonCode);
  if (Number.isFinite(reasonAsNumber)) {
    reasonCodeVariants.add(reasonAsNumber.toString());
  }

  const expectedPrefixes: string[] = [];
  const candidates: Array<{
    keyKind: "secret" | "password";
    variant: "short" | "invoiceWithAuth" | "full" | "createInvoiceRequest";
    source: string;
    expectedPrefix: string;
  }> = [];
  const authCodeVariants = valueVariants(payload.authCode);
  const cardPanVariants = valueVariants(payload.cardPan);
  const txStatusVariants = valueVariants(payload.transactionStatus);
  const parsedRef = parseOrderReference(orderReference);
  const refParts = orderReference.split("|");
  const refTimestampMsRaw =
    refParts.find((p) => /^\d{12,}$/.test(p)) ||
    "";
  const refTimestampSec = refTimestampMsRaw ? Math.floor(Number(refTimestampMsRaw) / 1000) : NaN;
  for (const { keyKind, key } of keysToTry) {
    for (const amount of amountVariants) {
      for (const reasonCode of reasonCodeVariants) {
        const shortSource = [merchantAccountFromCallback, orderReference, amount, currency].join(";");
        const short = signHmacMd5(shortSource, key).toLowerCase();
        expectedPrefixes.push(short.slice(0, 10));
        candidates.push({ keyKind, variant: "short", source: shortSource, expectedPrefix: short.slice(0, 10) });
        for (const ac of authCodeVariants) {
          const invoiceWithAuthSource = [merchantAccountFromCallback, orderReference, amount, currency, ac].join(";");
          const invoiceWithAuth = signHmacMd5(
            invoiceWithAuthSource,
            key,
          ).toLowerCase();
          expectedPrefixes.push(invoiceWithAuth.slice(0, 10));
          candidates.push({
            keyKind,
            variant: "invoiceWithAuth",
            source: invoiceWithAuthSource,
            expectedPrefix: invoiceWithAuth.slice(0, 10),
          });

          if (parsedRef && Number.isFinite(refTimestampSec) && refTimestampSec > 0) {
            const name = productLabel(parsedRef.kind);
            const createInvoiceSource = [
              merchantAccountFromCallback,
              merchantDomainName,
              orderReference,
              String(refTimestampSec),
              amount,
              currency,
              name,
              "1",
              amount,
            ].join(";");
            const createInvoiceExpected = signHmacMd5(createInvoiceSource, key).toLowerCase();
            expectedPrefixes.push(createInvoiceExpected.slice(0, 10));
            candidates.push({
              keyKind,
              variant: "createInvoiceRequest",
              source: createInvoiceSource,
              expectedPrefix: createInvoiceExpected.slice(0, 10),
            });
          }
          for (const cp of cardPanVariants) {
            for (const tx of txStatusVariants) {
              const fullSource = [merchantAccountFromCallback, orderReference, amount, currency, ac, cp, tx, reasonCode].join(";");
              const full = signHmacMd5(
                fullSource,
                key,
              ).toLowerCase();
              expectedPrefixes.push(full.slice(0, 10));
              candidates.push({ keyKind, variant: "full", source: fullSource, expectedPrefix: full.slice(0, 10) });
            }
          }
        }
      }
    }
  }

  return {
    providedPrefix: provided.slice(0, 10),
    provided,
    expectedPrefixes: Array.from(new Set(expectedPrefixes)).slice(0, 8),
    candidates: candidates.slice(0, 80),
    merchantAccountFromCallback,
    merchantAccountFromEnv,
    keyFingerprints: {
      secret: fingerprint(merchantSecretKey),
      password: fingerprint(merchantPassword || ""),
    },
    fields: {
      orderReference,
      amountRaw,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCodeRaw,
    },
  };
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

  if (String(process.env.WAYFORPAY_DEBUG_LOGS || "").toLowerCase() === "true") {
    strapi.log.info(
      `[wfp-create] account=${config.merchantAccount} domain=${config.merchantDomainName} keyFp(secret)=${fingerprint(
        config.merchantSecretKey,
      )} keyFp(password)=${fingerprint(config.merchantPassword || "")} orderReference=${orderReference} amount=${amount} currency=${CURRENCY}`,
    );
  }

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

async function grantMediumAccess(userId: number, userDocId: string, options?: { skipUserFlagUpdate?: boolean }): Promise<void> {
  const knex = strapi.db?.connection;
  if (!options?.skipUserFlagUpdate) {
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
  }

  const allMethodSections = await strapi.entityService.findMany("api::method-section.method-section", {
    fields: ["id", "slug", "documentId"],
  } as any);
  const methodSections = (allMethodSections as any[])
    .map((ms) => ({
      id: Number(ms?.id),
      documentId: typeof ms?.documentId === "string" ? ms.documentId : "",
    }))
    .filter((x) => Number.isFinite(x.id) && x.id > 0 && x.documentId.length > 0);
  if (methodSections.length === 0) return;

  const existing = await strapi.entityService.findMany("api::user-method-section.user-method-section", {
    filters: { user: { id: userId } },
    populate: { method_section: { fields: ["id", "documentId"] } },
  } as any);

  const existingByMethodId = new Map<number, { entryId: number; isPaid: boolean }>();
  for (const x of existing as any[]) {
    // Cleanup broken rows that have no linked method section.
    if (!x?.method_section?.id) {
      await strapi.entityService.delete("api::user-method-section.user-method-section", x.id);
      continue;
    }
    const methodId = Number(x?.method_section?.id);
    if (!Number.isFinite(methodId) || methodId <= 0) continue;
    existingByMethodId.set(methodId, { entryId: x.id as number, isPaid: x.isPaid === true });
  }

  for (const methodSection of methodSections) {
    const methodSectionId = methodSection.id;
    const existingEntry = existingByMethodId.get(methodSectionId);
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
        user: userId,
        method_section: { connect: [methodSection.documentId] },
        isPaid: true,
      } as any,
    });
  }
}

async function grantPremiumAccess(userId: number, userDocId: string, options?: { skipUserFlagUpdate?: boolean }): Promise<void> {
  const knex = strapi.db?.connection;
  if (!options?.skipUserFlagUpdate) {
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
  }

  await grantMediumAccess(userId, userDocId, options);
}

async function grantMakCardsAccess(userId: number, options?: { skipUserFlagUpdate?: boolean }): Promise<void> {
  if (options?.skipUserFlagUpdate) return;
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
  const methodSection = await strapi.entityService.findOne("api::method-section.method-section", methodSectionId, {
    fields: ["id", "slug", "title", "documentId"],
  } as any);
  if (!methodSection) return;
  const methodSectionDocId = (methodSection as any).documentId as string | undefined;
  if (!methodSectionDocId) return;

  const existing = await strapi.entityService.findMany("api::user-method-section.user-method-section", {
    filters: {
      user: { id: userId },
      method_section: { id: methodSectionId },
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
      user: userId,
      method_section: { connect: [methodSectionDocId] },
      isPaid: true,
    } as any,
  });
}

export async function applyPaidAccess(kind: AccessKind, userId: number, options?: { skipUserFlagUpdate?: boolean }): Promise<void> {
  const user = await strapi.query("plugin::users-permissions.user").findOne({ where: { id: userId } });
  if (!user) return;
  const userDocId = (user as any).documentId as string | undefined;

  if (kind === "mak-cards") {
    await grantMakCardsAccess(userId, options);
    return;
  }

  if (!userDocId) return;
  if (kind === "medium") {
    await grantMediumAccess(userId, userDocId, options);
    return;
  }
  if (kind === "section") {
    return;
  }
  await grantPremiumAccess(userId, userDocId, options);
}

export async function applyPaidSectionAccess(userId: number, methodSectionId: number): Promise<void> {
  await grantSingleSectionAccess(userId, methodSectionId);
}

export async function revokeAllMethodicsAccess(userId: number): Promise<void> {
  await cleanupBrokenUserMethodSectionRows();

  const existing = await strapi.entityService.findMany("api::user-method-section.user-method-section", {
    filters: { user: { id: userId } },
    fields: ["id"],
  } as any);

  for (const entry of existing as any[]) {
    await strapi.entityService.delete("api::user-method-section.user-method-section", entry.id);
  }
}

export async function cleanupBrokenUserMethodSectionRows(): Promise<void> {
  const knex = strapi.db?.connection;
  if (!knex) return;
  try {
    await knex("user_method_sections").whereNull("user_id").orWhereNull("method_section_id").del();
  } catch {
    // Ignore cleanup failures; main flows should keep working.
  }
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

  const existing = await strapi.entityService.findMany("api::user-method-section.user-method-section", {
    filters: {
      user: { id: userId },
      method_section: { id: methodSectionId },
      isPaid: true,
    },
    limit: 1,
  } as any);

  return existing.length > 0;
}
