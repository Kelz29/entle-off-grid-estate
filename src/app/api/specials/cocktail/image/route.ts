import { NextResponse } from "next/server";
import { getCocktailSpecial, parseDataUrl } from "@/lib/cocktail-special";
import { readFile } from "fs/promises";
import path from "path";

const BUSINESS_ID = Number(process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1");

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

async function readPublicImage(imageSrc: string): Promise<{
  buffer: Buffer;
  mime: string;
} | null> {
  const rel = imageSrc.startsWith("/") ? imageSrc.slice(1) : imageSrc;
  if (rel.includes("..")) return null;
  try {
    const filePath = path.join(process.cwd(), "public", rel);
    const buffer = await readFile(filePath);
    return { buffer, mime: mimeForExt(path.extname(filePath)) };
  } catch {
    return null;
  }
}

/** Serves the current special flyer (uploaded bytes or public file). */
export async function GET() {
  try {
    const config = await getCocktailSpecial(BUSINESS_ID);
    if (config.image_data_url) {
      const parsed = parseDataUrl(config.image_data_url);
      if (parsed) {
        return new NextResponse(new Uint8Array(parsed.buffer), {
          headers: {
            "Content-Type": parsed.mime,
            "Cache-Control": "private, no-store",
          },
        });
      }
    }

    const file =
      (await readPublicImage(config.image_src)) ??
      (await readPublicImage("/specials/cocktail-friday-sunday.jpg"));
    if (!file) {
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
