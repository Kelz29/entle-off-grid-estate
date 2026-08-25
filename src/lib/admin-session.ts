import type { AdminRole } from "./admin-roles";
import { isAdminRole } from "./admin-roles";

/** Edge-safe session helpers (Web Crypto only). Used by middleware. */

export const ADMIN_SESSION_COOKIE = "eoe_admin_session";
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 24; // 1 day

export type SessionPayload = {
  u: string;
  role: AdminRole;
  exp: number;
};

function sessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_TOKEN ||
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
    new TextEncoder().encode(sessionSecret()),
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

export async function createSessionToken(
  username: string,
  role: AdminRole = "owner"
): Promise<string> {
  const payloadObj: SessionPayload = {
    u: username,
    role,
    exp: Date.now() + ADMIN_SESSION_MAX_AGE_SEC * 1000,
  };
  const payload = b64urlEncode(
    new TextEncoder().encode(JSON.stringify(payloadObj))
  );
  const sig = await hmacSign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token || !sessionSecret()) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacSign(payload);
  if (!timingSafeEqualStr(sig, expected)) return null;
  try {
    const parsed = JSON.parse(b64urlDecodeToString(payload)) as SessionPayload & {
      role?: string;
    };
    if (!parsed?.u || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    const role: AdminRole = isAdminRole(parsed.role) ? parsed.role : "owner";
    return { u: parsed.u, role, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(
    new RegExp(`(?:^|;\\s*)${ADMIN_SESSION_COOKIE}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}
