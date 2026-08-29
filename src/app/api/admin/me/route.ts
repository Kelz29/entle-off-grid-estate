import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/admin-auth";
import {
  canAccessSection,
  canBroadcast,
  canManageContent,
  canManageSeats,
  canManageSpecials,
  canManageUsers,
  sectionsForRole,
  type AdminSection,
} from "@/lib/admin-roles";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const role = session.role;
  const sections = sectionsForRole(role);
  return NextResponse.json({
    authenticated: true,
    user: session.u,
    role,
    sections,
    permissions: {
      users: canManageUsers(role),
      broadcast: canBroadcast(role),
      seats: canManageSeats(role),
      specials: canManageSpecials(role),
      content: canManageContent(role),
      payments: canAccessSection(role, "payments" as AdminSection),
      clients: canAccessSection(role, "clients" as AdminSection),
    },
  });
}
