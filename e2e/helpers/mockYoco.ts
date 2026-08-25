import type { Page, Route } from "@playwright/test";
import { randomUUID } from "crypto";
import { createReleaseToken } from "../../src/lib/booking-release-token";
import { markBookingPaid } from "./db";

type CheckoutBody = {
  event_type?: string;
  start_time?: string;
  invitee?: { name?: string; email?: string; phone?: string };
  guests?: number;
};

async function createPendingViaCheckoutBypass(
  page: Page,
  body: CheckoutBody
): Promise<{ bookingId: string; releaseToken: string }> {
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const { getPool, mysqlAvailable } = await import("./db");
  if (!(await mysqlAvailable())) {
    throw new Error("MySQL required for mocked checkout");
  }

  const pool = await getPool();
  const [services] = await pool.query(
    `SELECT id, business_id, duration_minutes, exclusive, price_cents
       FROM services WHERE is_active = 1 ORDER BY id ASC LIMIT 1`
  );
  const serviceRows = services as Array<{
    id: number;
    business_id: number;
    duration_minutes: number;
    exclusive: number;
    price_cents: number;
  }>;
  const service = serviceRows[0];
  if (!service) throw new Error("No services seeded");

  const email =
    body.invitee?.email?.trim() || `e2e-${Date.now()}@example.com`;
  const name = body.invitee?.name?.trim() || "E2E Guest";
  const guests = body.guests ?? 2;
  const start = body.start_time
    ? new Date(body.start_time)
    : new Date(Date.now() + 7 * 24 * 3600_000);
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);

  await pool.query(
    `INSERT INTO customers (business_id, name, email, phone)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [service.business_id, name, email, body.invitee?.phone ?? null]
  );
  const [custRows] = await pool.query(
    `SELECT id FROM customers WHERE business_id = ? AND email = ? LIMIT 1`,
    [service.business_id, email]
  );
  const customerId = (custRows as Array<{ id: number }>)[0]?.id;
  if (!customerId) throw new Error("Could not resolve customer");

  const amount = (service.price_cents || 10000) * guests + 3000;
  const bookingId = randomUUID();
  await pool.query(
    `INSERT INTO bookings (
       id, business_id, service_id, customer_id, start_time, end_time,
       status, guests, is_exclusive, guest_name, guest_email, guest_phone,
       payment_status, payment_amount_cents, seen
     ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 'unpaid', ?, 0)`,
    [
      bookingId,
      service.business_id,
      service.id,
      customerId,
      start,
      end,
      guests,
      service.exclusive ? 1 : 0,
      name,
      email,
      body.invitee?.phone ?? null,
      amount,
    ]
  );
  const releaseToken = await createReleaseToken(bookingId);
  void cookieHeader;
  void page;
  return { bookingId, releaseToken };
}

export type MockYocoMode = "success" | "cancelled" | "failed";

export async function mockYocoCheckout(
  page: Page,
  mode: MockYocoMode = "success"
) {
  await page.route("**/api/bookings/checkout", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    let body: CheckoutBody = {};
    try {
      body = route.request().postDataJSON() as CheckoutBody;
    } catch {
      /* empty */
    }
    try {
      const { bookingId, releaseToken } = await createPendingViaCheckoutBypass(
        page,
        body
      );
      if (mode === "success") {
        await markBookingPaid(bookingId);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            redirectUrl: `http://localhost:3000/booking/success/${bookingId}`,
            bookingId,
            releaseToken,
          }),
        });
        return;
      }
      const path = mode === "cancelled" ? "cancelled" : "failed";
      const qs = `token=${encodeURIComponent(releaseToken)}`;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          redirectUrl: `http://localhost:3000/booking/${path}/${bookingId}?${qs}`,
          bookingId,
          releaseToken,
        }),
      });
    } catch (err) {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          detail: err instanceof Error ? err.message : "Mock checkout failed",
        }),
      });
    }
  });
}
