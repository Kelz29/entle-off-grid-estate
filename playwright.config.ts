import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

/** Load .env.local into process.env (no dotenv dependency). */
function loadEnvLocal() {
  const p = path.join(__dirname, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    // Prefer an already-running estate app (e.g. yarn dev on :3001) via
    // PLAYWRIGHT_BASE_URL — avoids latching onto an unrelated Next.js on :3000.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "yarn dev",
        // Hit an estate-only route so we don't reuse a random Next.js on :3000.
        url: "http://localhost:3000/api/specials/cocktail",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          RATE_LIMIT_DISABLED: "1",
        },
      },
});
