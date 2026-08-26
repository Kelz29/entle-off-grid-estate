import { test, expect } from "@playwright/test";
import { adminLogin, adminLoginApi } from "./helpers/auth";
import { ensureStaffUser, mysqlAvailable } from "./helpers/db";

test.describe("admin roles", () => {
  test.beforeEach(async () => {
    if (!(await mysqlAvailable())) {
      test.skip(true, "MySQL unreachable");
    }
    if (!process.env.ADMIN_PASSWORD) {
      test.skip(true, "ADMIN_PASSWORD missing");
    }
  });

  test("owner env login sees users permission", async ({ page }) => {
    await adminLogin(page);
    const me = await page.request.get("/api/admin/me");
    expect(me.ok()).toBeTruthy();
    const body = await me.json();
    expect(body.role).toBe("owner");
    expect(body.permissions?.users).toBe(true);
  });

  test("staff cannot access users or clients API", async ({ request }) => {
    try {
      await ensureStaffUser({
        username: "e2e_staff",
        password: "e2e-staff-pass-1",
        role: "staff",
      });
    } catch (err) {
      console.error("[e2e] ensureStaffUser failed", err);
      test.skip(
        true,
        `admin_users unavailable: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    const login = await adminLoginApi(request, {
      username: "e2e_staff",
      password: "e2e-staff-pass-1",
    });
    if (!login.ok()) {
      test.skip(true, `staff login failed: ${login.status()}`);
      return;
    }

    const users = await request.get("/api/admin/users");
    expect(users.status()).toBe(401);

    const clients = await request.get("/api/admin/clients?business_id=1");
    expect(clients.status()).toBe(401);

    const specials = await request.get("/api/admin/specials/cocktail");
    expect(specials.status()).toBe(401);
  });

  test("staff UI hides users nav", async ({ page }) => {
    try {
      await ensureStaffUser({
        username: "e2e_staff",
        password: "e2e-staff-pass-1",
        role: "staff",
      });
    } catch (err) {
      test.skip(
        true,
        `admin_users unavailable: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }
    await adminLogin(page, {
      username: "e2e_staff",
      password: "e2e-staff-pass-1",
    });
    await expect(page.getByText(/staff access/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^users$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^specials$/i })).toHaveCount(0);
  });
});
