import { NextResponse } from "next/server";
import { getActiveBusiness, listServices } from "@/lib/calendly/repository";
import { serializeEventType, collection } from "@/lib/calendly/serializers";

// GET /api/v1/calendly/event_types?business_id=1&active=true&count=20
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = Number(url.searchParams.get("business_id"));
    if (!Number.isInteger(businessId)) {
      return NextResponse.json(
        { detail: "business_id is required" },
        { status: 400 }
      );
    }

    const business = await getActiveBusiness(businessId);
    if (!business) {
      return NextResponse.json(
        { detail: "Business not found" },
        { status: 404 }
      );
    }

    const activeParam = url.searchParams.get("active");
    const active =
      activeParam === null ? undefined : activeParam === "true";

    const count = clampCount(url.searchParams.get("count"));

    const services = await listServices({ businessId, active, count });
    return NextResponse.json(
      collection(services.map((s) => serializeEventType(s, business)))
    );
  } catch (err) {
    console.error("[event_types]", err);
    const message =
      err instanceof Error ? err.message : "Unable to load event types";
    // Missing env is a deploy config issue; connection errors are usually
    // MySQL firewall / host not allowing Vercel.
    const detail = /Missing required environment variable/i.test(message)
      ? "Booking database is not configured on this deployment."
      : /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|PROTOCOL/i.test(message)
        ? "Booking database is unreachable from the server. Check MySQL host access (allow remote / Vercel IPs)."
        : "Unable to load bookable spaces.";
    return NextResponse.json({ detail }, { status: 503 });
  }
}

function clampCount(raw: string | null, def = 20): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return def;
  return Math.min(100, Math.max(1, Math.trunc(n)));
}
