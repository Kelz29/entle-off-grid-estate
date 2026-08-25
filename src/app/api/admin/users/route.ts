import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { canManageUsers, isAdminRole } from "@/lib/admin-roles";
import {
  createAdminUser,
  listAdminUsers,
} from "@/lib/admin-users";

export async function GET(request: Request) {
  const session = await requireAdminSession(request);
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  try {
    const collection = await listAdminUsers();
    return NextResponse.json({ collection });
  } catch (err) {
    return NextResponse.json(
      {
        detail:
          err instanceof Error
            ? err.message
            : "Could not load users (is admin_users migrated?)",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await requireAdminSession(request);
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let body: {
    username?: string;
    password?: string;
    display_name?: string;
    role?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 422 });
  }

  if (!isAdminRole(body.role)) {
    return NextResponse.json({ detail: "Invalid role" }, { status: 422 });
  }
  if (body.role === "owner") {
    return NextResponse.json(
      { detail: "Create manager or staff accounts here. Owner uses env login." },
      { status: 422 }
    );
  }

  try {
    const user = await createAdminUser({
      username: String(body.username ?? ""),
      password: String(body.password ?? ""),
      displayName: String(body.display_name ?? ""),
      role: body.role,
    });
    return NextResponse.json({ resource: user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create user";
    const status = /already|Duplicate|unique/i.test(message) ? 409 : 422;
    return NextResponse.json({ detail: message }, { status });
  }
}
