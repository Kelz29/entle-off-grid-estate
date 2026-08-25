import { NextResponse } from "next/server";
import {
  adminCredentialsConfigured,
  authenticateAdmin,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/admin-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rl = rateLimit(`login:${clientIp(request)}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      }
    );
  }

  if (!adminCredentialsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Admin login is not configured. Set ADMIN_USER, ADMIN_PASSWORD, and ADMIN_TOKEN (or ADMIN_SESSION_SECRET).",
      },
      { status: 503 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  const auth = await authenticateAdmin(username, password);
  if (!auth) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const token = await createSessionToken(auth.username, auth.role);
  const res = NextResponse.json({
    ok: true,
    user: auth.username,
    role: auth.role,
  });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
