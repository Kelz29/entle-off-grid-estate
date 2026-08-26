import { test, expect } from "@playwright/test";
import { adminLoginApi } from "./helpers/auth";
import { mysqlAvailable } from "./helpers/db";

type SpecialResource = {
  enabled: boolean;
  eyebrow: string;
  image_src: string;
  image_alt: string;
  cta_label: string;
  cta_href: string;
  image_url: string;
  has_upload: boolean;
};

test.describe("cocktail special", () => {
  let original: SpecialResource | null = null;

  test.beforeEach(async ({ request }) => {
    if (!(await mysqlAvailable())) {
      test.skip(true, "MySQL unreachable");
    }
    if (!process.env.ADMIN_PASSWORD) {
      test.skip(true, "ADMIN_PASSWORD missing");
    }

    const login = await adminLoginApi(request);
    if (!login.ok()) {
      test.skip(true, `admin login failed: ${login.status()}`);
    }

    const get = await request.get("/api/admin/specials/cocktail");
    expect(get.ok()).toBeTruthy();
    const body = await get.json();
    original = body.resource as SpecialResource;
  });

  test.afterEach(async ({ request }) => {
    if (!original) return;
    await request.patch("/api/admin/specials/cocktail", {
      data: {
        enabled: original.enabled,
        eyebrow: original.eyebrow,
        image_src: original.image_src,
        image_alt: original.image_alt,
        cta_label: original.cta_label,
        cta_href: original.cta_href,
        clear_image_upload: true,
      },
    });
  });

  test("admin PATCH updates public API and home modal eyebrow", async ({
    request,
    page,
  }) => {
    const marker = `E2E Special ${Date.now()}`;
    const patch = await request.patch("/api/admin/specials/cocktail", {
      multipart: {
        enabled: "true",
        eyebrow: marker,
        image_alt: "E2E alt text for cocktail special",
        cta_label: "E2E Book",
        cta_href: "#booking",
        image_src: "/specials/cocktail-friday-sunday.jpg",
      },
    });
    expect(patch.ok()).toBeTruthy();
    const saved = (await patch.json()).resource as SpecialResource;
    expect(saved.eyebrow).toBe(marker);
    expect(saved.cta_label).toBe("E2E Book");
    expect(saved.enabled).toBe(true);

    const pub = await request.get("/api/specials/cocktail");
    expect(pub.ok()).toBeTruthy();
    expect(pub.headers()["cache-control"] ?? "").toMatch(/no-store/i);
    const pubBody = (await pub.json()).resource as SpecialResource;
    expect(pubBody.eyebrow).toBe(marker);
    expect(pubBody.cta_label).toBe("E2E Book");

    await page.goto("/");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 8_000 });
    await expect(dialog).toContainText(marker, { ignoreCase: true });
    await expect(dialog.getByRole("link", { name: /e2e book/i })).toBeVisible();
  });

  test("disabled special does not show on the home page", async ({
    request,
    page,
  }) => {
    const patch = await request.patch("/api/admin/specials/cocktail", {
      data: { enabled: false },
    });
    expect(patch.ok()).toBeTruthy();
    expect((await patch.json()).resource.enabled).toBe(false);

    const pub = await request.get("/api/specials/cocktail");
    expect((await pub.json()).resource.enabled).toBe(false);

    await page.goto("/");
    await page.waitForTimeout(2200);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("staff cannot PATCH specials", async ({ request }) => {
    const { ensureStaffUser } = await import("./helpers/db");
    try {
      await ensureStaffUser({
        username: "e2e_staff_specials",
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

    // Drop owner session by logging in as staff on this request context.
    await request.post("/api/admin/logout");
    const login = await adminLoginApi(request, {
      username: "e2e_staff_specials",
      password: "e2e-staff-pass-1",
    });
    if (!login.ok()) {
      test.skip(true, `staff login failed: ${login.status()}`);
      return;
    }

    const patch = await request.patch("/api/admin/specials/cocktail", {
      data: { eyebrow: "Staff should not write" },
    });
    expect(patch.status()).toBe(401);
  });
});
