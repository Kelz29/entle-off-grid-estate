import type { Page, APIRequestContext } from "@playwright/test";

export async function adminLogin(
  page: Page,
  opts?: { username?: string; password?: string }
) {
  const username = opts?.username ?? process.env.ADMIN_USER ?? "admin";
  const password = opts?.password ?? process.env.ADMIN_PASSWORD ?? "";
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin(?!\/login)/);
}

export async function adminLoginApi(
  request: APIRequestContext,
  opts?: { username?: string; password?: string }
) {
  const username = opts?.username ?? process.env.ADMIN_USER ?? "admin";
  const password = opts?.password ?? process.env.ADMIN_PASSWORD ?? "";
  const res = await request.post("/api/admin/login", {
    data: { username, password },
  });
  return res;
}
