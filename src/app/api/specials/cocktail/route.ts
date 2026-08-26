import { NextResponse } from "next/server";
import {
  getCocktailSpecial,
  parseDataUrl,
  toCocktailSpecialResource,
} from "@/lib/cocktail-special";

const BUSINESS_ID = Number(process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1");

/** Public config for the home-page cocktail special modal. */
export async function GET() {
  try {
    const config = await getCocktailSpecial(BUSINESS_ID);
    return NextResponse.json(
      { resource: toCocktailSpecialResource(config) },
      {
        headers: {
          // Admin can change this anytime — never serve a stale flyer config.
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { detail: "Could not load special" },
      { status: 500 }
    );
  }
}
