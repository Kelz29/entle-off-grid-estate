/**
 * Short-lived HMAC tokens that authorize releasing a pending unpaid booking
 * hold (cancel/fail return from Yoco). Stops guessing booking IDs.
 */

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function secret(): string {
  return (
    process.env.BOOKING_RELEASE_SECRET ||
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_SESSION_SECRET ||
    ""
  );
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeToString(value: string): string {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(b64);
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return b64urlEncode(sig);
}

export async function createReleaseToken(bookingId: string): Promise<string> {
  if (!secret()) {
    throw new Error("BOOKING_RELEASE_SECRET (or ADMIN_TOKEN) is not configured");
  }
  const payload = b64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({ bid: bookingId, exp: Date.now() + TTL_MS })
    )
  );
  const sig = await hmacSign(payload);
  return `${payload}.${sig}`;
}

export async function verifyReleaseToken(
  token: string | undefined | null,
  bookingId: string
): Promise<boolean> {
  if (!token || !secret()) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = await hmacSign(payload);
  if (!timingSafeEqualStr(sig, expected)) return false;
  try {
    const parsed = JSON.parse(b64urlDecodeToString(payload)) as {
      bid?: string | number;
      exp?: number;
    };
    if (String(parsed.bid) !== bookingId) return false;
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return false;
    return true;
  } catch {
    return false;
  }
}
