import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/admin-auth";
import { changeOwnPassword } from "@/lib/admin-users";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Logged-in staff change their own password (DB accounts only).
 * Env owner (ADMIN_USER) must update ADMIN_PASSWORD in the environment.
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`pw-change:${session.u}:${clientIp(request)}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { detail: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { current_password?: string; new_password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 422 });
  }

  const current =
    typeof body.current_password === "string" ? body.current_password : "";
  const next = typeof body.new_password === "string" ? body.new_password : "";
  if (!current || !next) {
    return NextResponse.json(
      { detail: "current_password and new_password are required" },
      { status: 422 }
    );
  }

  try {
    await changeOwnPassword({
      username: session.u,
      currentPassword: current,
      newPassword: next,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        detail:
          err instanceof Error ? err.message : "Could not change password",
      },
      { status: 422 }
    );
  }
}
