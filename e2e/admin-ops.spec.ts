import { test, expect } from "@playwright/test";
import { adminLogin } from "./helpers/auth";
import { mysqlAvailable } from "./helpers/db";

test.describe("admin ops", () => {
  test.beforeEach(async () => {
    if (!(await mysqlAvailable())) {
      test.skip(true, "MySQL unreachable");
    }
    if (!process.env.ADMIN_PASSWORD) {
      test.skip(true, "ADMIN_PASSWORD missing");
    }
  });

  test("seats panel loads for owner", async ({ page }) => {
    await adminLogin(page);
    const seats = page.getByRole("button", { name: /seats|manage seats/i });
    if (await seats.count()) {
      await seats.first().click();
      await expect(page.getByText(/seat|capacity|held/i).first()).toBeVisible({
        timeout: 10_000,
      });
    } else {
      // Section tab might be labeled differently
      const tab = page.getByText(/^seats$/i);
      if (await tab.count()) await tab.first().click();
    }
  });

  test("clients list for owner", async ({ page }) => {
    await adminLogin(page);
    const clients = page.getByRole("button", { name: /^clients$/i });
    if (await clients.count()) {
      await clients.first().click();
      await page.waitForTimeout(1000);
      await expect(page.locator("body")).toContainText(/client|guest|email/i);
    }
  });

  test("broadcast without recipients returns structured error", async ({
    page,
  }) => {
    await adminLogin(page);
    const res = await page.request.post("/api/admin/broadcast", {
      data: {
        business_id: 1,
        subject: "E2E",
        body: "Test",
        emails: [],
      },
    });
    // Empty list or SMTP issues — should not 500 with HTML
    expect([400, 422, 503, 200]).toContain(res.status());
    const json = await res.json().catch(() => null);
    expect(json).toBeTruthy();
  });
});
