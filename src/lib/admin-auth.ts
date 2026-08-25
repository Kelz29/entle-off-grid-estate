import { cookies } from "next/headers";
import type { AdminRole } from "./admin-roles";
import { authenticateDbUser } from "./admin-users";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  clearSessionCookieOptions,
  createSessionToken,
  readSessionCookie,
  sessionCookieOptions,
  verifySessionToken,
  type SessionPayload,
} from "./admin-session";

export {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  clearSessionCookieOptions,
  createSessionToken,
  readSessionCookie,
  sessionCookieOptions,
  verifySessionToken,
  type SessionPayload,
};

function sessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_TOKEN ||
    ""
  );
}

function adminUser(): string {
  return process.env.ADMIN_USER?.trim() || "admin";
}

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

export function adminCredentialsConfigured(): boolean {
  return Boolean(sessionSecret() && adminPassword());
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Env owner login (always role owner). */
export function verifyEnvPassword(username: string, password: string): boolean {
  if (!adminCredentialsConfigured()) return false;
  return (
    timingSafeEqualStr(username.trim(), adminUser()) &&
    timingSafeEqualStr(password, adminPassword())
  );
}

/** Prefer DB staff accounts; fall back to env owner. Node-only (uses scrypt). */
export async function authenticateAdmin(
  username: string,
  password: string
): Promise<{ username: string; role: AdminRole } | null> {
  try {
    const dbUser = await authenticateDbUser(username, password);
    if (dbUser) return { username: dbUser.username, role: dbUser.role };
  } catch {
    /* table may not exist yet */
  }
  if (verifyEnvPassword(username, password)) {
    return { username: username.trim(), role: "owner" };
  }
  return null;
}

export async function isAdminAuthorized(request: Request): Promise<boolean> {
  const session = await verifySessionToken(readSessionCookie(request));
  if (session) return true;

  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  // Bearer only — no ?token= query param (leaks via logs/Referer).
  const auth = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  const token = match?.[1]?.trim() ?? "";
  if (!token) return false;
  return timingSafeEqualStr(token, expected);
}

export async function requireAdminSession(
  request: Request
): Promise<SessionPayload | null> {
  return verifySessionToken(readSessionCookie(request));
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
}
