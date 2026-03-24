import { Readable } from "node:stream";

/**
 * WayForPay may POST application/x-www-form-urlencoded where the JSON payload is the field name
 * (or the whole body is JSON). Default parsers can truncate or split the body; we buffer the raw
 * bytes and re-feed them so strapi::body still runs on a full stream.
 */
export default (_config: unknown, _opts: { strapi: unknown }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const path = String(ctx.path || "");
    if (ctx.method !== "POST" || !path.endsWith("/payments/wayforpay-callback")) {
      await next();
      return;
    }

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      ctx.req.on("data", (c: Buffer | string) => {
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      });
      ctx.req.on("end", () => resolve());
      ctx.req.on("error", reject);
    });

    const buf = Buffer.concat(chunks);
    ctx.state.wayforpayRawBody = buf.toString("utf8");

    const restored = Readable.from(buf) as NodeJS.ReadableStream & { headers?: unknown; method?: string; url?: string };
    Object.assign(restored, {
      headers: ctx.req.headers,
      method: ctx.req.method,
      url: ctx.req.url,
    });
    ctx.req = restored as typeof ctx.req;

    await next();
  };
};
