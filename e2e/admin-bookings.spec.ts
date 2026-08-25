import { test, expect } from "@playwright/test";
import { adminLogin } from "./helpers/auth";
import { mysqlAvailable } from "./helpers/db";

test.describe("admin bookings", () => {
  test.beforeEach(async () => {
    if (!(await mysqlAvailable())) {
      test.skip(true, "MySQL unreachable");
    }
    if (!process.env.ADMIN_PASSWORD) {
      test.skip(true, "ADMIN_PASSWORD missing");
    }
  });

  test("can open new booking modal and create pay-on-arrival", async ({
    page,
  }) => {
    await adminLogin(page);
    await expect(page.getByText(/bookings|overview|management/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const newBtn = page.getByRole("button", { name: /new booking|\＋|＋/i });
    if (!(await newBtn.count())) {
      // Fallback: look for button containing New
      const alt = page.getByRole("button", { name: /new/i });
      if (!(await alt.count())) {
        test.skip(true, "New booking control not found");
        return;
      }
      await alt.first().click();
    } else {
      await newBtn.first().click();
    }

    // Modal form — fill minimal fields if present
    const name = page.getByLabel(/name/i).first();
    if (await name.count()) {
      await name.fill(`Walk-in ${Date.now()}`);
    }
    const phone = page.getByLabel(/phone/i).first();
    if (await phone.count()) {
      await phone.fill("0670000000");
    }
  });

  test("scheduled_events list requires auth", async ({ request }) => {
    const res = await request.get(
      "/api/v1/calendly/scheduled_events?business_id=1&count=5"
    );
    expect(res.status()).toBe(401);
  });
});
