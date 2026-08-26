import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { canManageSpecials } from "@/lib/admin-roles";
import {
  fileToDataUrl,
  getCocktailSpecial,
  toCocktailSpecialResource,
  updateCocktailSpecial,
  type CocktailSpecialPatch,
} from "@/lib/cocktail-special";

const BUSINESS_ID = Number(process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1");

async function requireSpecialsAdmin(request: Request) {
  const session = await requireAdminSession(request);
  if (!session || !canManageSpecials(session.role)) return null;
  return session;
}

export async function GET(request: Request) {
  if (!(await requireSpecialsAdmin(request))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  try {
    const config = await getCocktailSpecial(BUSINESS_ID);
    return NextResponse.json({
      resource: toCocktailSpecialResource(config),
    });
  } catch {
    return NextResponse.json(
      { detail: "Could not load special" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await requireSpecialsAdmin(request))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    let patch: CocktailSpecialPatch = {};

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const enabled = form.get("enabled");
      if (enabled === "true" || enabled === "false") {
        patch.enabled = enabled === "true";
      }
      for (const key of [
        "eyebrow",
        "image_src",
        "image_alt",
        "cta_label",
        "cta_href",
      ] as const) {
        const v = form.get(key);
        if (typeof v === "string") patch[key] = v;
      }
      if (form.get("clear_image_upload") === "true") {
        patch.clear_image_upload = true;
      }
      const file = form.get("image");
      if (file instanceof File && file.size > 0) {
        try {
          patch.image_data_url = await fileToDataUrl(file);
          patch.clear_image_upload = false;
        } catch (err) {
          return NextResponse.json(
            {
              detail:
                err instanceof Error ? err.message : "Invalid image upload",
            },
            { status: 422 }
          );
        }
      }
    } else {
      const body = (await request.json()) as CocktailSpecialPatch;
      patch = body ?? {};
    }

    const config = await updateCocktailSpecial(BUSINESS_ID, patch);
    if (!config) {
      return NextResponse.json({ detail: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({
      resource: toCocktailSpecialResource(config),
    });
  } catch (err) {
    console.error("[admin/specials] save failed", err);
    return NextResponse.json(
      { detail: "Could not save special" },
      { status: 500 }
    );
  }
}
