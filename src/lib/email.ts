import nodemailer, { type Transporter } from "nodemailer";
import type { BookingRow, BusinessRow } from "./calendly/types";

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
  return `Entle Off-Grid Estate <${email}>`;
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
// Shared call-to-action for every notification.
const CALL_CTA = `Anything you'd like to ask, reschedule, or cancel? Give us a call on <strong style="color:#2a1a12;">${PHONE}</strong> and we'll happily sort it out.`;

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
        <td style="padding:8px 0;color:#8a7a72;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:120px;vertical-align:top;">${k}</td>
        <td style="padding:8px 0;color:#2a1a12;font-size:15px;">${v}</td>
      </tr>`
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4efe9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe9;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(42,26,18,0.08);">
          <tr><td style="background:${CLAY};padding:26px 32px;">
            <p style="margin:0;color:#ffffff;font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">Entle Off-Grid Estate</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:600;">${opts.heading}</h1>
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
            183 Lakeview, Bloemfontein · 067 366 2302 · Fri–Sun, 11:00–18:00
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
    )}${outroText}\n\nEntle Off-Grid Estate · 183 Lakeview, Bloemfontein · ${PHONE}`;
}

async function send(to: string, subject: string, heading: string, intro: string, rows: [string, string][], outro?: string): Promise<void> {
  const transport = getTransport();
  if (!transport || !to) return;
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
}

function baseRows(b: BookingRow, business: BusinessRow): [string, string][] {
  const rows: [string, string][] = [
    ["Experience", b.service_name ?? ""],
    ["When", whenLabel(b.start_time, business.timezone)],
    ["Guests", String(b.guests)],
  ];
  if (business.address) rows.push(["Where", business.address]);
  return rows;
}

export async function sendBookingConfirmation(b: BookingRow, business: BusinessRow) {
  const rows = baseRows(b, business);
  rows.push(["Deposit paid", money(b.payment_amount_cents)]);
  await send(
    b.customer_email ?? "",
    "Your booking is confirmed · Entle Off-Grid Estate",
    "You're booked in",
    `Thank you, ${b.customer_name ?? "there"} — your payment went through and your booking is confirmed. Your deposit is deducted from your bill when you arrive.`,
    rows,
    `We can't wait to host you. ${CALL_CTA}`
  );
}

export async function sendBookingRescheduled(b: BookingRow, business: BusinessRow) {
  await send(
    b.customer_email ?? "",
    "Your booking has been moved · Entle Off-Grid Estate",
    "Your booking has moved",
    `Hi ${b.customer_name ?? "there"}, your booking has been rescheduled. Here are the new details:`,
    baseRows(b, business),
    `Your deposit carries over to the new time. ${CALL_CTA}`
  );
}

export async function sendBookingCancelled(b: BookingRow, business: BusinessRow) {
  await send(
    b.customer_email ?? "",
    "Your booking has been cancelled · Entle Off-Grid Estate",
    "Your booking is cancelled",
    `Hi ${b.customer_name ?? "there"}, your booking below has been cancelled.`,
    baseRows(b, business),
    `If you paid a deposit, our team will be in touch about it. ${CALL_CTA}`
  );
}
