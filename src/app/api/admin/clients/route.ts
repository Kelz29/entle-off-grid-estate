import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { canAccessSection } from "@/lib/admin-roles";
import { listClients } from "@/lib/calendly/repository";

// GET /api/admin/clients?business_id=1
export async function GET(request: Request) {
  const session = await requireAdminSession(request);
  if (!session || !canAccessSection(session.role, "clients")) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const businessId = Number(url.searchParams.get("business_id") ?? 1);
  if (!Number.isInteger(businessId) || businessId < 1) {
    return NextResponse.json({ detail: "business_id is required" }, { status: 400 });
  }

  const clients = await listClients(businessId);
  return NextResponse.json({ collection: clients });
}
