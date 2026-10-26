import crypto from "crypto";

function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Constant-time check of a Shopify webhook HMAC (base64) against the raw request body. */
export function verifyShopifyHmac(rawBody: string, hmacHeader: string, secret: string | undefined): boolean {
    if (!secret || !hmacHeader) return false;
    const hash = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
    return safeEqual(hash, hmacHeader);
}

/**
 * Guard for cron/utility endpoints. When CRON_SECRET is set (Vercel Cron then
 * sends it as `Authorization: Bearer <secret>`), requests without it are
 * rejected. When it is not set the endpoint stays open, as before.
 */
export function isAuthorizedCron(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true;
    return safeEqual(req.headers.get("authorization") || "", `Bearer ${secret}`);
}
