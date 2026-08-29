import nodemailer, { type Transporter } from "nodemailer";
import type { BookingRow, BusinessRow } from "./calendly/types";
import { carTypeLabel } from "./calendly/car-wash";
import { enqueueEmailDetached } from "./email-queue";
import { DEFAULT_SITE_CONTENT } from "./content/defaults";

// SMTP transporter from env (SMTP_HOST/PORT/USER/PASSWORD/FROM_EMAIL).
// Cached on globalThis so dev hot-reloads don't open a new pool each time.
const g = globalThis as unknown as { _mailer?: Transporter | null };

function getTransport(): Transporter | null {
  if (g._mailer !== undefined) return g._mailer;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    g._mailer = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  g._mailer = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
    // Small mail hosts often present a cert that doesn't match the mail.* host.
    tls: { rejectUnauthorized: false },
  });
  return g._mailer;
}

export function emailConfigured(): boolean {
  return getTransport() !== null;
}

function fromAddress(): string {
  const email = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "";
  return `Entle Off Grid Estate <${email}>`;
}

function money(cents?: number | null): string {
  if (!cents) return "R0";
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}

function whenLabel(value: string | Date, tz: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const CLAY = "#9a6552";
const PHONE = "067 366 2302";
const VENUE_HOURS_FOOTER = `182 Lakeview Bloemfontein · ${PHONE} · ${DEFAULT_SITE_CONTENT.site.diningHours}; ${DEFAULT_SITE_CONTENT.site.privateFunctionsNote}`;
// Shared call-to-action for every notification.
const CALL_CTA = `Anything you'd like to ask, reschedule, or cancel? Give us a call on <strong style="color:#2a1a12;">${PHONE}</strong> and we'll happily sort it out.`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEmail(opts: {
  heading: string;
  intro: string;
  rows: [string, string][];
  outro?: string;
}): string {
  const rowsHtml = opts.rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:8px 0;color:#8a7a72;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:120px;vertical-align:top;">${escapeHtml(k)}</td>
        <td style="padding:8px 0;color:#2a1a12;font-size:15px;">${escapeHtml(v)}</td>
      </tr>`
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4efe9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe9;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(42,26,18,0.08);">
          <tr><td style="background:${CLAY};padding:26px 32px;">
            <p style="margin:0;color:#ffffff;font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">Entle Off Grid Estate</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:600;">${escapeHtml(opts.heading)}</h1>
          </td></tr>
          <tr><td style="padding:28px 32px;">
            <p style="margin:0 0 18px;color:#2a1a12;font-size:15px;line-height:1.6;">${opts.intro}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;">
              ${rowsHtml}
            </table>
            ${
              opts.outro
                ? `<p style="margin:18px 0 0;color:#6a5a52;font-size:13px;line-height:1.6;">${opts.outro}</p>`
                : ""
            }
          </td></tr>
          <tr><td style="padding:18px 32px;border-top:1px solid #f0eae4;color:#9a8a82;font-size:12px;">
            ${VENUE_HOURS_FOOTER}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function textFallback(
  heading: string,
  intro: string,
  rows: [string, string][],
  outro?: string
): string {
  const outroText = outro ? `\n\n${outro.replace(/<[^>]+>/g, "")}` : "";
  return `${heading}\n\n${intro}\n\n${rows
    .map(([k, v]) => `${k}: ${v}`)
    .join(
      "\n"
    )}${outroText}\n\nEntle Off Grid Estate · 182 Lakeview Bloemfontein · ${PHONE}`;
}

async function send(to: string, subject: string, heading: string, intro: string, rows: [string, string][], outro?: string): Promise<void> {
  const transport = getTransport();
  // @noemail.local = placeholder for manual (phone/walk-in) bookings made from
  // the admin dashboard without a real address — never try to mail it.
  if (!transport || !to || to.endsWith("@noemail.local")) return;
  // Serial queue: 30s between each outbound message. Detached so booking
  // webhooks / admin PATCH don't wait out the gap.
  enqueueEmailDetached(async () => {
    try {
      await transport.sendMail({
        from: fromAddress(),
        to,
        subject,
        text: textFallback(heading, intro, rows, outro),
        html: renderEmail({ heading, intro, rows, outro }),
      });
    } catch (err) {
      // Best-effort — never let a mail failure break the booking flow.
      console.error("[email] failed to send:", err instanceof Error ? err.message : err);
    }
  });
}

function baseRows(b: BookingRow, business: BusinessRow): [string, string][] {
  const rows: [string, string][] = [
    ["Experience", b.service_name ?? ""],
    ["When", whenLabel(b.start_time, business.timezone)],
    ["Guests", String(b.guests)],
  ];
  if (b.cars != null && b.cars > 0) {
    const labels = (() => {
      let raw: unknown = b.car_types;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = null;
        }
      }
      if (!Array.isArray(raw)) return null;
      return raw
        .filter((x): x is string => typeof x === "string")
        .map(carTypeLabel)
        .join(", ");
    })();
    rows.push([
      "Cars",
      labels ? `${b.cars} (${labels})` : String(b.cars),
    ]);
  }
  if (business.address) rows.push(["Where", business.address]);
  return rows;
}

export async function sendBookingConfirmation(b: BookingRow, business: BusinessRow) {
  const rows = baseRows(b, business);
  rows.push(["Amount paid", money(b.payment_amount_cents)]);
  const name = escapeHtml(b.customer_name ?? "there");
  await send(
    b.customer_email ?? "",
    "Your booking is confirmed · Entle Off Grid Estate",
    "You're booked in",
    `Thank you, ${name}. Your payment went through and your booking is confirmed. Your deposit is deducted from your bill when you arrive.`,
    rows,
    `We can't wait to host you. ${CALL_CTA}`
  );
}

export async function sendBookingRescheduled(b: BookingRow, business: BusinessRow) {
  const name = escapeHtml(b.customer_name ?? "there");
  await send(
    b.customer_email ?? "",
    "Your booking has been moved · Entle Off Grid Estate",
    "Your booking has moved",
    `Hi ${name}, your booking has been rescheduled. Here are the new details:`,
    baseRows(b, business),
    `Your deposit carries over to the new time. ${CALL_CTA}`
  );
}

export async function sendBookingCancelled(b: BookingRow, business: BusinessRow) {
  const name = escapeHtml(b.customer_name ?? "there");
  await send(
    b.customer_email ?? "",
    "Your booking has been cancelled · Entle Off Grid Estate",
    "Your booking is cancelled",
    `Hi ${name}, your booking below has been cancelled.`,
    baseRows(b, business),
    `If you paid a deposit, our team will be in touch about it. ${CALL_CTA}`
  );
}

function bodyToHtml(body: string): string {
  return escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;color:#2a1a12;font-size:15px;line-height:1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/**
 * Build + queue a marketing email (shared 30s gap with booking mail).
 * Returns false if skipped (no SMTP / placeholder / empty).
 */
function prepareMarketingMail(input: {
  to: string;
  name?: string | null;
  subject: string;
  body: string;
}): {
  to: string;
  subject: string;
  text: string;
  html: string;
} | null {
  const transport = getTransport();
  const to = input.to.trim().toLowerCase();
  if (!transport || !to || to.endsWith("@noemail.local")) return null;
  if (!input.subject.trim() || !input.body.trim()) return null;

  const greeting = input.name?.trim()
    ? `Hi ${escapeHtml(input.name.trim())},`
    : "Hi there,";
  const html = `<!doctype html><html><body style="margin:0;background:#f4efe9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe9;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(42,26,18,0.08);">
          <tr><td style="background:${CLAY};padding:26px 32px;">
            <p style="margin:0;color:#ffffff;font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">Entle Off Grid Estate</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:600;">${escapeHtml(input.subject.trim())}</h1>
          </td></tr>
          <tr><td style="padding:28px 32px;">
            <p style="margin:0 0 14px;color:#2a1a12;font-size:15px;line-height:1.6;">${greeting}</p>
            ${bodyToHtml(input.body.trim())}
            <p style="margin:18px 0 0;color:#6a5a52;font-size:13px;line-height:1.6;">${CALL_CTA}</p>
          </td></tr>
          <tr><td style="padding:18px 32px;border-top:1px solid #f0eae4;color:#9a8a82;font-size:12px;">
            ${VENUE_HOURS_FOOTER}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;

  const text = `${input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi there,"}\n\n${input.body.trim()}\n\nEntle Off Grid Estate · ${PHONE}`;

  return {
    to,
    subject: `${input.subject.trim()} · Entle Off Grid Estate`,
    text,
    html,
  };
}

/**
 * Queue a marketing / specials email (does not wait for the 30s gap / SMTP).
 */
export function queueMarketingEmail(input: {
  to: string;
  name?: string | null;
  subject: string;
  body: string;
}): boolean {
  const transport = getTransport();
  const prepared = prepareMarketingMail(input);
  if (!transport || !prepared) return false;

  enqueueEmailDetached(async () => {
    try {
      await transport.sendMail({
        from: fromAddress(),
        to: prepared.to,
        subject: prepared.subject,
        text: prepared.text,
        html: prepared.html,
      });
    } catch (err) {
      console.error(
        "[email] broadcast failed:",
        err instanceof Error ? err.message : err
      );
    }
  });
  return true;
}

/** Queue a marketing email (same as queueMarketingEmail; async for older callers). */
export async function sendMarketingEmail(input: {
  to: string;
  name?: string | null;
  subject: string;
  body: string;
}): Promise<boolean> {
  return queueMarketingEmail(input);
}

/** Emergency alert when a paid deferred booking cannot be stored (DB down). */
export async function sendDeferredBookingAlert(
  payload: {
    bookingId: string;
    guestName: string;
    guestEmail: string;
    startTime: string;
    guests: number;
    amountCents: number;
  },
  checkoutId: string,
  err: unknown
): Promise<void> {
  const transport = getTransport();
  const to =
    process.env.DEFERRED_ALERT_EMAIL?.trim() ||
    process.env.SMTP_FROM_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim();
  if (!transport || !to) {
    console.error("[email] deferred alert skipped — no SMTP/to", err);
    return;
  }

  const detail =
    err instanceof Error ? err.message : String(err ?? "unknown error");
  const subject = `URGENT: paid booking needs manual sync (${payload.bookingId})`;
  const text = [
    "A guest paid via Yoco but the booking could not be saved automatically.",
    "",
    `Booking id: ${payload.bookingId}`,
    `Checkout: ${checkoutId}`,
    `Guest: ${payload.guestName} <${payload.guestEmail}>`,
    `When: ${payload.startTime}`,
    `Guests: ${payload.guests}`,
    `Amount cents: ${payload.amountCents}`,
    "",
    `Error: ${detail}`,
  ].join("\n");

  enqueueEmailDetached(async () => {
    try {
      await transport.sendMail({
        from: fromAddress(),
        to,
        subject,
        text,
        html: `<pre style="font-family:monospace;font-size:13px;">${escapeHtml(text)}</pre>`,
      });
    } catch (mailErr) {
      console.error("[email] deferred alert failed:", mailErr);
    }
  });
}
