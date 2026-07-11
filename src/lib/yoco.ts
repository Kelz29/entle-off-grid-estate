import crypto from "crypto";

// Server-side Yoco client — Checkout API (hosted redirect) + webhook verification.
// Docs: https://developer.yoco.com/online/api-reference/checkout
// The legacy Popup SDK + /v1/charges API has been sunsetted.

const CHECKOUTS_URL = "https://payments.yoco.com/api/checkouts";

export const YOCO_CURRENCY = process.env.YOCO_CURRENCY ?? "ZAR";

export interface YocoCheckout {
  id: string;
  redirectUrl: string;
  status: string; // "created" | ... | "completed"
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export class YocoError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "YocoError";
  }
}

function secretKey(): string {
  const key = process.env.YOCO_SECRET_KEY;
  if (!key) throw new YocoError("YOCO_SECRET_KEY is not configured");
  return key;
}

/** Create a hosted checkout. Returns the object incl. `redirectUrl`. */
export async function createCheckout(input: {
  amountInCents: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  metadata?: Record<string, string>;
}): Promise<YocoCheckout> {
  let res: Response;
  try {
    res = await fetch(CHECKOUTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
        // Idempotency guard against duplicate checkouts on ret/refresh.
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        amount: input.amountInCents,
        currency: input.currency ?? YOCO_CURRENCY,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        failureUrl: input.failureUrl,
        metadata: input.metadata,
      }),
    });
  } catch (err) {
    throw new YocoError(
      `Could not reach Yoco: ${err instanceof Error ? err.message : "network error"}`
    );
  }

  const body = (await res.json().catch(() => ({}))) as
    | YocoCheckout
    | { message?: string; description?: string };

  if (!res.ok) {
    const msg =
      ("description" in body && body.description) ||
      ("message" in body && body.message) ||
      "Could not create checkout";
    throw new YocoError(String(msg), res.status);
  }
  return body as YocoCheckout;
}

/** Retrieve a checkout by id (fallback reconciliation of payment status). */
export async function getCheckout(id: string): Promise<YocoCheckout> {
  const res = await fetch(`${CHECKOUTS_URL}/${id}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const body = (await res.json().catch(() => ({}))) as YocoCheckout;
  if (!res.ok) throw new YocoError("Could not fetch checkout", res.status);
  return body;
}

/**
 * Verify a Yoco webhook using the standard-webhooks / Svix scheme.
 * signed content = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 * key = base64-decoded secret (after the `whsec_` prefix)
 * signature = base64( HMAC-SHA256(key, signedContent) )
 * The `webhook-signature` header is a space-separated list of `v1,<sig>`.
 */
export function verifyWebhookSignature(input: {
  rawBody: string;
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
  secret?: string;
  toleranceSeconds?: number;
}): boolean {
  const secret = input.secret ?? process.env.YOCO_WEBHOOK_SECRET;
  const { rawBody, webhookId, webhookTimestamp, webhookSignature } = input;
  if (!secret || !webhookId || !webhookTimestamp || !webhookSignature) {
    return false;
  }

  // Replay protection: reject timestamps outside the tolerance window.
  const tolerance = input.toleranceSeconds ?? 180;
  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > tolerance) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // Header may carry several space-delimited "v1,<sig>" entries.
  for (const part of webhookSignature.split(" ")) {
    const idx = part.indexOf(",");
    const sig = idx === -1 ? part : part.slice(idx + 1);
    if (safeEqual(sig, expected)) return true;
  }
  return false;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
