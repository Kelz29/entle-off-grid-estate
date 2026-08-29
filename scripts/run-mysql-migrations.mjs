/**
 * Apply incremental MySQL migrations (idempotent). Reads MYSQL_* from .env.local.
 *
 * Usage: node scripts/run-mysql-migrations.mjs
 *        node scripts/run-mysql-migrations.mjs --check   (audit only, no changes)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = [
  "migrate-bookings-uuid.mysql.sql",
  "migrate-special-request.mysql.sql",
  "migrate-site-content.mysql.sql",
  "migrate-deferred-bookings.mysql.sql",
];

function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
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

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in .env.local`);
  return v;
}

async function audit(conn) {
  const checks = [
    {
      label: "bookings.id is UUID (CHAR/VARCHAR)",
      sql: `SELECT DATA_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'id'`,
      ok: (rows) =>
        rows[0] && ["char", "varchar"].includes(String(rows[0].DATA_TYPE).toLowerCase()),
    },
    {
      label: "bookings.special_request column",
      sql: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'special_request'`,
      ok: (rows) => Number(rows[0]?.n) > 0,
    },
    {
      label: "bookings.car_types column",
      sql: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'car_types'`,
      ok: (rows) => Number(rows[0]?.n) > 0,
    },
    {
      label: "bookings.seen column",
      sql: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'seen'`,
      ok: (rows) => Number(rows[0]?.n) > 0,
    },
    {
      label: "bookings.guest_name snapshot column",
      sql: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'guest_name'`,
      ok: (rows) => Number(rows[0]?.n) > 0,
    },
    {
      label: "admin_users table",
      sql: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_users'`,
      ok: (rows) => Number(rows[0]?.n) > 0,
    },
    {
      label: "site_content table",
      sql: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'site_content'`,
      ok: (rows) => Number(rows[0]?.n) > 0,
    },
    {
      label: "media_assets table",
      sql: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_assets'`,
      ok: (rows) => Number(rows[0]?.n) > 0,
    },
    {
      label: "deferred_bookings table",
      sql: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deferred_bookings'`,
      ok: (rows) => Number(rows[0]?.n) > 0,
    },
  ];

  console.log("Schema audit:");
  for (const c of checks) {
    const [rows] = await conn.query(c.sql);
    const pass = c.ok(rows);
    console.log(`  ${pass ? "✓" : "✗"} ${c.label}`);
  }
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  loadEnvLocal();

  const conn = await mysql.createConnection({
    host: requireEnv("MYSQL_HOST"),
    port: Number(process.env.MYSQL_PORT || 3306),
    user: requireEnv("MYSQL_USER"),
    password: requireEnv("MYSQL_PASSWORD"),
    database: requireEnv("MYSQL_DATABASE"),
    connectTimeout: 20_000,
    multipleStatements: true,
  });

  console.log(
    `Connected to ${process.env.MYSQL_HOST}/${process.env.MYSQL_DATABASE}`
  );

  if (checkOnly) {
    await audit(conn);
    await conn.end();
    return;
  }

  await audit(conn);
  console.log("\nApplying migrations…");

  for (const file of MIGRATIONS) {
    const full = path.join(ROOT, "db", file);
    if (!fs.existsSync(full)) {
      throw new Error(`Missing migration file: ${file}`);
    }
    const sql = fs.readFileSync(full, "utf8");
    process.stdout.write(`  → ${file} … `);
    try {
      await conn.query(sql);
      console.log("ok");
    } catch (err) {
      console.log("FAILED");
      throw err;
    }
  }

  console.log("\nPost-migration audit:");
  await audit(conn);
  await conn.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message || err);
  process.exit(1);
});
