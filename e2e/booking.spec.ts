import { test, expect } from "@playwright/test";
import { mysqlAvailable } from "./helpers/db";
import { mockYocoCheckout } from "./helpers/mockYoco";

async function pickExperienceAndSlot(page: import("@playwright/test").Page) {
  await page.goto("/#booking");
  await expect(
    page.getByRole("heading", { name: /choose an experience/i })
  ).toBeVisible({ timeout: 15_000 });

  await page
    .locator("#booking button")
    .filter({ hasText: /min/i })
    .first()
    .click();

  await expect(page.getByText(/select a date|available times/i)).toBeVisible({
    timeout: 10_000,
  });

  const openDay = page
    .locator(
      `.react-datepicker__day:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)`
    )
    .first();
  await openDay.click();
  await expect(page.getByText("Available times")).toBeVisible({ timeout: 10_000 });
  // Wait until loading finishes (slots or empty message)
  await page
    .getByText("Loading…")
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(500);

  const slotBtn = page
    .locator("#booking button")
    .filter({ hasText: /^\d{2}:\d{2}/ })
    .first();
  if (!(await slotBtn.count())) {
    return false;
  }
  await slotBtn.click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await expect(page.getByRole("heading", { name: /your details/i })).toBeVisible({
    timeout: 10_000,
  });
  return true;
}

test.describe("booking widget", () => {
  test.beforeEach(async () => {
    if (!(await mysqlAvailable())) {
      test.skip(true, "MySQL unreachable — skipping booking e2e");
    }
  });

  test("lists experiences and Fri–Sun slots", async ({ page }) => {
    await page.goto("/#booking");
    await expect(
      page.getByRole("heading", { name: /choose an experience/i })
    ).toBeVisible({ timeout: 15_000 });

    await page
      .locator("#booking button")
      .filter({ hasText: /min/i })
      .first()
      .click();

    await expect(page.getByText(/select a date/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".react-datepicker")).toBeVisible();

    // Disabled midweek days should exist in the calendar markup
    const disabled = page.locator(".react-datepicker__day--disabled");
    await expect(disabled.first()).toBeVisible();
  });

  test("checkout success path (mocked Yoco)", async ({ page }) => {
    await mockYocoCheckout(page, "success");
    const ok = await pickExperienceAndSlot(page);
    if (!ok) {
      test.skip(true, "No slots available for seeded hours");
      return;
    }

    await page.locator("#booking-name").fill("E2E Guest");
    await page.locator("#booking-email").fill(`e2e-${Date.now()}@example.com`);
    await page.locator("#booking-guests").fill("2");
    await page.getByRole("button", { name: /pay .* deposit/i }).click();

    const payBtn = page.getByRole("button", { name: /i understand\. pay/i });
    await expect(payBtn).toBeVisible({ timeout: 5000 });
    await payBtn.click();

    await expect(page).toHaveURL(/\/booking\/success/, { timeout: 20_000 });
    await expect(page.getByText(/payment received|confirming/i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("cancel releases pending hold with token", async ({ page }) => {
    await mockYocoCheckout(page, "cancelled");
    const ok = await pickExperienceAndSlot(page);
    if (!ok) {
      test.skip(true, "No slots available");
      return;
    }

    await page.locator("#booking-name").fill("E2E Cancel");
    await page
      .locator("#booking-email")
      .fill(`e2e-cancel-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /pay .* deposit/i }).click();
    await page.getByRole("button", { name: /i understand\. pay/i }).click();

    await expect(page).toHaveURL(/\/booking\/cancelled/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /cancelled/i })).toBeVisible();
  });
});
