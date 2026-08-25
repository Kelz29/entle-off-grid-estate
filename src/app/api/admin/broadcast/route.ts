import { NextResponse, after } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { canBroadcast } from "@/lib/admin-roles";
import { listClients } from "@/lib/calendly/repository";
import {
  emailConfigured,
  queueMarketingEmail,
} from "@/lib/email";
import {
  emailQueueBusy,
  emailQueueEtaSeconds,
  emailQueueGapSeconds,
} from "@/lib/email-queue";

/**
 * POST /api/admin/broadcast
 * Body: { business_id?, subject, body, emails?: string[] }
 * Queues individually (privacy) with 30s between sends. Returns immediately.
 */
export async function POST(request: Request) {
  const session = await requireAdminSession(request);
  if (!session || !canBroadcast(session.role)) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { detail: "Email is not configured (SMTP_* env vars)" },
      { status: 503 }
    );
  }

  let body: {
    business_id?: number;
    subject?: string;
    body?: string;
    emails?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 422 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  if (subject.length < 2 || message.length < 2) {
    return NextResponse.json(
      { detail: "subject and body are required" },
      { status: 422 }
    );
  }

  const businessId = Number(body.business_id ?? 1);
  const clients = await listClients(businessId);
  const byEmail = new Map(
    clients.map((c) => [c.email.toLowerCase(), c] as const)
  );

  let targets = clients;
  if (Array.isArray(body.emails) && body.emails.length > 0) {
    const wanted = new Set(
      body.emails
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    );
    targets = [...wanted]
      .map((e) => byEmail.get(e))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }

  if (targets.length === 0) {
    return NextResponse.json(
      { detail: "No matching clients to email" },
      { status: 422 }
    );
  }

  let queued = 0;
  let skipped = 0;
  for (const c of targets) {
    const ok = queueMarketingEmail({
      to: c.email,
      name: c.name,
      subject,
      body: message,
    });
    if (ok) queued++;
    else skipped++;
  }

  // Keep the isolate alive while the in-process queue drains (30s gaps).
  after(async () => {
    while (emailQueueBusy()) {
      await new Promise((r) => setTimeout(r, 5_000));
    }
  });

  return NextResponse.json({
    ok: true,
    total: targets.length,
    queued,
    skipped,
    gap_seconds: emailQueueGapSeconds(),
    eta_seconds: emailQueueEtaSeconds(),
  });
}
