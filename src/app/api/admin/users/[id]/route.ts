import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { canManageUsers, isAdminRole } from "@/lib/admin-roles";
import { deleteAdminUser, updateAdminUser } from "@/lib/admin-users";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession(request);
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ detail: "Invalid id" }, { status: 400 });
  }

  let body: {
    display_name?: string;
    role?: string;
    is_active?: boolean;
    password?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 422 });
  }

  if (body.role != null && !isAdminRole(body.role)) {
    return NextResponse.json({ detail: "Invalid role" }, { status: 422 });
  }
  if (body.role === "owner") {
    return NextResponse.json(
      { detail: "Cannot assign owner via this screen" },
      { status: 422 }
    );
  }

  try {
    const user = await updateAdminUser(id, {
      displayName: body.display_name,
      role: body.role && isAdminRole(body.role) ? body.role : undefined,
      isActive: body.is_active,
      password: body.password,
    });
    if (!user) {
      return NextResponse.json({ detail: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ resource: user });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Could not update user" },
      { status: 422 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession(_request);
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ detail: "Invalid id" }, { status: 400 });
  }
  const ok = await deleteAdminUser(id);
  if (!ok) {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
