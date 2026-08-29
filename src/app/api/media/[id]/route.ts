import { NextResponse } from "next/server";
import { getMediaAsset } from "@/lib/content/repository";
import { isMediaId } from "@/lib/content/media-limits";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isMediaId(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const asset = await getMediaAsset(id);
    if (!asset || asset.data.length === 0) {
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse(new Uint8Array(asset.data), {
      headers: {
        "Content-Type": asset.mime_type || "application/octet-stream",
        "Content-Length": String(asset.byte_size),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${asset.sha256}"`,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
