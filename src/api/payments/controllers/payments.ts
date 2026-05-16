import {
  applyPaidAccess,
  applyPaidSectionAccess,
  buildWayForPayCallbackAck,
  checkAccessStatus,
  expectedCurrency,
  expectedPrice,
  getWayForPaySignatureDebug,
  isSuccessTransactionStatus,
  parseOrderReference,
  verifyWayForPayCallbackSignature,
} from "../services/payments";

/** Parse callback JSON from raw body (see https://wiki.wayforpay.com/view/852102 — serviceUrl). */
function parseWayForPayFromRaw(raw: string): Record<string, any> | null {
  const t = raw.trim();
  if (!t) return null;

  const tryJson = (s: string): Record<string, any> | null => {
    try {
      const p = JSON.parse(s) as Record<string, any>;
      return p?.orderReference ? p : null;
    } catch {
      return null;
    }
  };

  let p = tryJson(t);
  if (p) return p;

  const firstBrace = t.indexOf("{");
  if (firstBrace >= 0) {
    let depth = 0;
    for (let i = firstBrace; i < t.length; i++) {
      const ch = t[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          p = tryJson(t.slice(firstBrace, i + 1));
          if (p) return p;
          break;
        }
      }
    }
  }

  const eq = t.indexOf("=");
  if (eq > 0) {
    const keyPart = t.slice(0, eq);
    for (const cand of [keyPart, decodeURIComponent(keyPart.replace(/\+/g, " "))]) {
      p = tryJson(cand);
      if (p) return p;
      const nested = parseWayForPayFromRaw(cand);
      if (nested) return nested;
    }
  }

  return null;
}

function parseFormEncodedString(raw: string): Record<string, any> {
  const out: Record<string, any> = {};
  const params = new URLSearchParams(raw);
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function extractLooseField(raw: string, field: string): string | undefined {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rxQuoted = new RegExp(`"${escaped}"\\s*:\\s*"([^"]*)"`);
  const mQuoted = raw.match(rxQuoted);
  if (mQuoted?.[1] != null) return mQuoted[1];

  const rxRaw = new RegExp(`"${escaped}"\\s*:\\s*([^,}\\s]+)`);
  const mRaw = raw.match(rxRaw);
  if (mRaw?.[1] != null) return mRaw[1].replace(/^"|"$/g, "");
  return undefined;
}

function parseLooseJsonLike(raw: string): Record<string, any> {
  const out: Record<string, any> = {};
  const fields = [
    "merchantAccount",
    "orderReference",
    "merchantSignature",
    "amount",
    "currency",
    "authCode",
    "cardPan",
    "transactionStatus",
    "reasonCode",
  ] as const;
  for (const f of fields) {
    const v = extractLooseField(raw, f);
    if (v !== undefined) out[f] = v;
  }
  if (out.amount !== undefined) {
    const n = Number(out.amount);
    if (Number.isFinite(n)) out.amount = n;
  }
  if (out.reasonCode !== undefined) {
    const n = Number(out.reasonCode);
    if (Number.isFinite(n)) out.reasonCode = n;
  }
  return out;
}

function normalizeCallbackPayload(input: unknown): Record<string, any> {
  if (!input) return {};

  if (Buffer.isBuffer(input)) {
    const s = input.toString("utf8");
    if (!s) return {};
    try {
      return JSON.parse(s) as Record<string, any>;
    } catch {
      return parseFormEncodedString(s);
    }
  }

  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return {};
    try {
      return JSON.parse(s) as Record<string, any>;
    } catch {
      return parseFormEncodedString(s);
    }
  }

  if (typeof input !== "object") return {};
  const body = input as Record<string, any>;
  if (body.orderReference) return body;

  const tryParseJsonLike = (raw: string): Record<string, any> | null => {
    if (!raw) return null;
    const candidates = [raw];
    try {
      candidates.push(decodeURIComponent(raw));
    } catch {
      // ignore
    }

    for (const candidate of candidates) {
      const s = String(candidate).trim();
      if (!s.startsWith("{")) continue;
      try {
        const parsed = JSON.parse(s) as Record<string, any>;
        if (parsed?.orderReference) return parsed;
      } catch {
        const loose = parseLooseJsonLike(s);
        if (loose?.orderReference) return loose;
      }
    }
    return null;
  };

  // WayForPay can send JSON string with form-urlencoded content type.
  // In that case body can be { '{"merchantAccount":"...","orderReference":"..."}': '' }
  // or { '%7B...%7D': '' } or { data: '{"..."}' }.
  const keys = Object.keys(body);
  for (const key of keys) {
    const fromKey = tryParseJsonLike(key);
    if (fromKey) return fromKey;

    const value = body[key];
    if (typeof value === "string") {
      const fromValue = tryParseJsonLike(value);
      if (fromValue) return fromValue;
      if (value.includes("=") && value.includes("&")) {
        const parsedForm = parseFormEncodedString(value);
        if (parsedForm.orderReference) return parsedForm;
      }
    } else if (Array.isArray(value) && typeof value[0] === "string") {
      const fromValue = tryParseJsonLike(value[0]);
      if (fromValue) return fromValue;
    }
  }

  // Sometimes form parser produces object where first key is full form body.
  if (keys.length === 1 && keys[0].includes("=") && keys[0].includes("&")) {
    const parsedForm = parseFormEncodedString(keys[0]);
    if (parsedForm.orderReference) return parsedForm;
  }

  if (keys.length === 1) {
    const loose = parseLooseJsonLike(keys[0]);
    if (loose.orderReference) return loose;
  }

  return body;
}

export default {
  async wayforpayCallback(ctx: any) {
    const debugLogsEnabled = String(process.env.WAYFORPAY_DEBUG_LOGS || "").toLowerCase() === "true";
    const rawBody = typeof ctx.state?.wayforpayRawBody === "string" ? ctx.state.wayforpayRawBody : "";
    const fromRaw = rawBody ? parseWayForPayFromRaw(rawBody) : null;
    const fromBody = normalizeCallbackPayload(ctx.request?.body);
    const payload = { ...fromBody, ...(fromRaw || {}) };
    const bodyKeys = ctx.request?.body && typeof ctx.request.body === "object" ? Object.keys(ctx.request.body) : [];
    if (debugLogsEnabled) {
      if (rawBody) {
        strapi.log.info(`[wfp-callback] rawBodyLen=${rawBody.length} rawParsedFields=${fromRaw ? Object.keys(fromRaw).join(",") : "none"}`);
      }
      const reqMeta = {
        method: ctx.request?.method,
        url: ctx.request?.url,
        contentType: String(ctx.request?.headers?.["content-type"] || ""),
        userAgent: String(ctx.request?.headers?.["user-agent"] || ""),
        ip: String(ctx.request?.headers?.["x-forwarded-for"] || ctx.request?.ip || ""),
      };
      strapi.log.info(`[wfp-callback] inbound meta=${JSON.stringify(reqMeta)} bodyKeys=${JSON.stringify(bodyKeys).slice(0, 300)}`);
      strapi.log.info(`[wfp-callback] inbound payload=${JSON.stringify(payload).slice(0, 2000)}`);
    }
    const orderReference = String(payload.orderReference || "");
    const transactionStatus = String(payload.transactionStatus || "");
    const reason = String(payload.reason || "");
    const reasonCodeRaw = payload.reasonCode;
    const reasonCode =
      reasonCodeRaw === "" || reasonCodeRaw === null || reasonCodeRaw === undefined ? NaN : Number(reasonCodeRaw);
    const authCode = String(payload.authCode || "");
    const derivedStatus =
      transactionStatus ||
      (Number.isFinite(reasonCode) && reasonCode === 1100 ? "Approved" : "") ||
      // Create-invoice wiki example uses reason "1100" with empty reasonCode.
      (String(payload.reason || "") === "1100" ? "Approved" : "") ||
      // Some callbacks send authCode before transactionStatus appears in body.
      (authCode ? "Approved" : "") ||
      (process.env.NODE_ENV !== "production" && authCode ? "Approved" : "");
    const amount = Number(payload.amount);
    const currency = String(payload.currency || "");

    if (!orderReference) {
      strapi.log.warn(
        `[wfp-callback] rejected: orderReference is required contentType=${String(
          ctx.request?.headers?.["content-type"] || "",
        )} bodyType=${typeof ctx.request?.body} bodyKeys=${JSON.stringify(bodyKeys).slice(0, 300)}`,
      );
      return ctx.badRequest("orderReference is required");
    }
    const signatureValid = verifyWayForPayCallbackSignature(payload);
    if (!signatureValid) {
      if (process.env.NODE_ENV === "production") {
        const debug = getWayForPaySignatureDebug(payload);
        const callbackPayloadPreview = JSON.stringify(payload)
          .slice(0, 1200)
          .replace(/\s+/g, " ");
        strapi.log.warn(
          `[wfp-callback] rejected: invalid merchantSignature orderReference=${orderReference} merchantAccountCb=${debug.merchantAccountFromCallback} merchantAccountEnv=${debug.merchantAccountFromEnv} keyFp(secret)=${debug.keyFingerprints.secret} keyFp(password)=${debug.keyFingerprints.password} providedPrefix=${debug.providedPrefix} expectedPrefixes=${debug.expectedPrefixes.join(",")} txStatus=${debug.fields.transactionStatus} amount=${debug.fields.amountRaw} currency=${debug.fields.currency} reasonCode=${debug.fields.reasonCodeRaw} payload=${callbackPayloadPreview}`,
        );
        if (debugLogsEnabled) {
          strapi.log.warn(
            `[wfp-callback] signature candidates provided=${debug.provided} candidates=${JSON.stringify(debug.candidates).slice(0, 6000)}`,
          );
        }
        return ctx.badRequest("Invalid merchantSignature");
      }
      if (process.env.NODE_ENV !== "production") {
        strapi.log.warn(
          `[wfp-callback] invalid merchantSignature ignored in non-production orderReference=${orderReference}`,
        );
      }
    }

    const parsed = parseOrderReference(orderReference);
    if (!parsed) {
      strapi.log.warn(`[wfp-callback] rejected: unknown orderReference format orderReference=${orderReference}`);
      return ctx.badRequest("Unknown orderReference format");
    }

    const expectedCurr = await expectedCurrency();
    if (currency !== expectedCurr) {
      strapi.log.warn(
        `[wfp-callback] rejected: unexpected currency orderReference=${orderReference} got=${currency} expected=${expectedCurr}`,
      );
      return ctx.badRequest("Unexpected currency");
    }
    const expectedAmt = await expectedPrice(parsed.kind);
    if (amount !== expectedAmt) {
      strapi.log.warn(
        `[wfp-callback] rejected: unexpected amount orderReference=${orderReference} got=${amount} expected=${expectedAmt}`,
      );
      return ctx.badRequest("Unexpected amount");
    }

    if (isSuccessTransactionStatus(derivedStatus)) {
      strapi.log.info(
        `[wfp-callback] approved orderReference=${orderReference} kind=${parsed.kind} userId=${parsed.userId}${parsed.methodSectionId ? ` methodSectionId=${parsed.methodSectionId}` : ""} status=${derivedStatus} reason=${reason} reasonCode=${reasonCode} authCode=${authCode}`,
      );
      if (parsed.kind === "section" && parsed.methodSectionId) {
        await applyPaidSectionAccess(parsed.userId, parsed.methodSectionId);
      } else {
        await applyPaidAccess(parsed.kind, parsed.userId);
      }
    } else {
      strapi.log.info(
        `[wfp-callback] skipped (status=${derivedStatus || transactionStatus}) orderReference=${orderReference} kind=${parsed.kind} userId=${parsed.userId} reason=${reason} reasonCode=${reasonCode} authCode=${authCode}`,
      );
    }

    ctx.set("Content-Type", "application/json; charset=utf-8");
    ctx.body = buildWayForPayCallbackAck(orderReference);
  },

  async paymentStatus(ctx: any) {
    const orderReference = String(ctx.request?.query?.orderReference || "");
    if (!orderReference) return ctx.badRequest("orderReference is required");

    const parsed = parseOrderReference(orderReference);
    if (!parsed) return ctx.badRequest("Unknown orderReference format");

    const paid = await checkAccessStatus(parsed.kind, parsed.userId, parsed.methodSectionId);
    ctx.body = {
      orderReference,
      kind: parsed.kind,
      userId: parsed.userId,
      methodSectionId: parsed.methodSectionId || null,
      paid,
    };
  },
};
