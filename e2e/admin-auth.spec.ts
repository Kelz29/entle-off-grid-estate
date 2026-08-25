import { test, expect } from "@playwright/test";
import { adminLogin } from "./helpers/auth";
import { mysqlAvailable } from "./helpers/db";

test.describe("admin auth", () => {
  test("redirects unauthenticated /admin to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("rejects bad credentials", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("wrong-password-xyz");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login success and logout", async ({ page }) => {
    if (!(await mysqlAvailable()) && !process.env.ADMIN_PASSWORD) {
      test.skip(true, "Admin credentials not configured");
    }
    if (!process.env.ADMIN_PASSWORD) {
      test.skip(true, "ADMIN_PASSWORD missing");
    }
    await adminLogin(page);
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10_000 });
  });

  test("open-redirect next param is rejected", async ({ page }) => {
    if (!process.env.ADMIN_PASSWORD) {
      test.skip(true, "ADMIN_PASSWORD missing");
    }
    await page.goto("/admin/login?next=https://evil.example/phish");
    await page.getByLabel("Username").fill(process.env.ADMIN_USER ?? "admin");
    await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    expect(page.url()).not.toContain("evil.example");
  });
});
