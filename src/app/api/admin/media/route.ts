import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { canManageContent } from "@/lib/admin-roles";
import { SITE_CONTENT_TAG } from "@/lib/content/get-public-content";
import {
  insertMediaIfQuotaAllows,
  listMediaAssets,
  sumMediaBytes,
} from "@/lib/content/repository";
import {
  formatBytes,
  kindFromMime,
  maxBytesForKind,
  mediaQuotaBytes,
  sanitizeFileName,
} from "@/lib/content/media-limits";

const BUSINESS_ID = Number(process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1");

async function requireContentAdmin(request: Request) {
  const session = await requireAdminSession(request);
  if (!session || !canManageContent(session.role)) return null;
  return session;
}

export async function GET(request: Request) {
  if (!(await requireContentAdmin(request))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  try {
    const [collection, used] = await Promise.all([
      listMediaAssets(BUSINESS_ID),
      sumMediaBytes(BUSINESS_ID),
    ]);
    const limit = mediaQuotaBytes();
    return NextResponse.json({
      collection,
      quota: {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        label: `${formatBytes(used)} / ${formatBytes(limit)}`,
      },
    });
  } catch (err) {
    console.error("[admin/media] list failed", err);
    return NextResponse.json(
      { detail: "Could not load media library" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await requireContentAdmin(request))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Expected multipart form data" }, { status: 422 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ detail: "Choose a file to upload" }, { status: 422 });
  }

  const mime = (file.type || "").toLowerCase();
  const kind = kindFromMime(mime);
  if (!kind) {
    return NextResponse.json(
      { detail: "Use a JPEG, PNG, WebP, GIF, or MP4 file." },
      { status: 422 }
    );
  }

  const cap = maxBytesForKind(kind);
  if (file.size > cap) {
    return NextResponse.json(
      {
        detail:
          kind === "video"
            ? "Video must be under 40 MB."
            : "Image must be under 5 MB.",
      },
      { status: 422 }
    );
  }

  const data = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(data).digest("hex");
  const quota = mediaQuotaBytes();

  try {
    const result = await insertMediaIfQuotaAllows({
      id: randomUUID(),
      businessId: BUSINESS_ID,
      kind,
      originalName: sanitizeFileName(file.name),
      mimeType: mime,
      byteSize: data.length,
      sha256,
      data,
      quotaBytes: quota,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          detail: `Library is full. ${formatBytes(result.remaining)} remaining of ${formatBytes(quota)}.`,
          remaining: result.remaining,
        },
        { status: 413 }
      );
    }
    revalidateTag(SITE_CONTENT_TAG, "max");
    revalidatePath("/");
    return NextResponse.json({ resource: result.row }, { status: 201 });
  } catch (err) {
    console.error("[admin/media] upload failed", err);
    return NextResponse.json(
      { detail: "Could not store the file" },
      { status: 500 }
    );
  }
}
