import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { canManageContent } from "@/lib/admin-roles";
import { SITE_CONTENT_TAG } from "@/lib/content/get-public-content";
import {
  getSiteContentOverlay,
  saveSiteContentOverlay,
} from "@/lib/content/repository";
import {
  isSiteSectionKey,
  resolveSiteContent,
  sanitizeOverlay,
} from "@/lib/content/resolve";
import type { SiteContentOverlay } from "@/lib/content/types";

const BUSINESS_ID = Number(process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1");

async function requireContentAdmin(request: Request) {
  const session = await requireAdminSession(request);
  if (!session || !canManageContent(session.role)) return null;
  return session;
}

function revalidatePublic() {
  revalidateTag(SITE_CONTENT_TAG, "max");
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/car-wash");
}

export async function GET(request: Request) {
  if (!(await requireContentAdmin(request))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  try {
    const { overlay, updatedAt } = await getSiteContentOverlay(BUSINESS_ID);
    return NextResponse.json({
      resource: resolveSiteContent(overlay),
      overlay,
      updated_at: updatedAt,
    });
  } catch (err) {
    console.error("[admin/content] load failed", err);
    return NextResponse.json(
      { detail: "Could not load site content" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await requireContentAdmin(request))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let body: {
    payload?: unknown;
    reset?: unknown;
    section?: unknown;
    data?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 422 });
  }

  const reset = Array.isArray(body.reset)
    ? body.reset.filter(isSiteSectionKey)
    : [];

  let patch: SiteContentOverlay = {};
  if (typeof body.section === "string" && isSiteSectionKey(body.section)) {
    patch[body.section] = body.data;
  } else if (body.payload && typeof body.payload === "object") {
    patch = sanitizeOverlay(body.payload);
  }

  try {
    const { overlay, updatedAt } = await saveSiteContentOverlay(
      BUSINESS_ID,
      patch,
      reset
    );
    revalidatePublic();
    return NextResponse.json({
      resource: resolveSiteContent(overlay),
      overlay,
      updated_at: updatedAt,
    });
  } catch (err) {
    console.error("[admin/content] save failed", err);
    return NextResponse.json(
      { detail: "Could not save site content" },
      { status: 500 }
    );
  }
}
