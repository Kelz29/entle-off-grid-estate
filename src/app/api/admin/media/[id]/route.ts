import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { canManageContent } from "@/lib/admin-roles";
import { SITE_CONTENT_TAG } from "@/lib/content/get-public-content";
import { isMediaId } from "@/lib/content/media-limits";
import {
  deleteMediaAsset,
  getMediaMeta,
  revertMediaInContent,
} from "@/lib/content/repository";

const BUSINESS_ID = Number(process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1");

async function requireContentAdmin(request: Request) {
  const session = await requireAdminSession(request);
  if (!session || !canManageContent(session.role)) return null;
  return session;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireContentAdmin(request))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isMediaId(id)) {
    return NextResponse.json({ detail: "Invalid media id" }, { status: 400 });
  }

  try {
    const existing = await getMediaMeta(id);
    if (!existing || existing.business_id !== BUSINESS_ID) {
      return NextResponse.json({ detail: "Not found" }, { status: 404 });
    }

    await revertMediaInContent(BUSINESS_ID, id);
    await deleteMediaAsset(BUSINESS_ID, id);

    revalidateTag(SITE_CONTENT_TAG, "max");
    revalidatePath("/");
    revalidatePath("/menu");
    revalidatePath("/car-wash");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/media] delete failed", err);
    return NextResponse.json(
      { detail: "Could not delete media" },
      { status: 500 }
    );
  }
}
