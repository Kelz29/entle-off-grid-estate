import { createPool, type Pool } from "mysql2/promise";

let pool: Pool | null = null;
let mysqlOk: boolean | null = null;

export function mysqlConfigured(): boolean {
  return Boolean(
    process.env.MYSQL_HOST &&
      process.env.MYSQL_USER &&
      process.env.MYSQL_DATABASE
  );
}

export async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE,
      connectionLimit: 2,
    });
  }
  return pool;
}

/** Probe MySQL; cache result for the test run. */
export async function mysqlAvailable(): Promise<boolean> {
  if (mysqlOk !== null) return mysqlOk;
  if (!mysqlConfigured()) {
    mysqlOk = false;
    return false;
  }
  try {
    const p = await getPool();
    await p.query("SELECT 1");
    mysqlOk = true;
  } catch {
    mysqlOk = false;
  }
  return mysqlOk;
}

export function skipIfNoMysql(test: {
  skip: (condition?: boolean, description?: string) => void;
}) {
  // Call after await mysqlAvailable() in beforeAll / test body
}

export async function markBookingPaid(bookingId: string): Promise<void> {
  const p = await getPool();
  await p.query(
    `UPDATE bookings
        SET status = 'active', payment_status = 'paid',
            payment_amount_cents = COALESCE(payment_amount_cents, 10000),
            updated_at = NOW(3)
      WHERE id = ?`,
    [bookingId]
  );
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const p = await getPool();
  await p.query(`DELETE FROM bookings WHERE id = ?`, [bookingId]);
}

export async function ensureStaffUser(input: {
  username: string;
  password: string;
  role: "staff" | "manager";
}): Promise<void> {
  const { randomBytes, scrypt } = await import("crypto");
  const { promisify } = await import("util");
  const scryptAsync = promisify(scrypt) as (
    password: string,
    salt: Buffer,
    keylen: number,
    opts: { N: number; r: number; p: number }
  ) => Promise<Buffer>;
  const salt = randomBytes(16);
  const hash = await scryptAsync(input.password, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
  const stored = `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
  const p = await getPool();
  await p.query(
    `INSERT INTO admin_users (username, password_hash, display_name, role, is_active)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash),
       role = VALUES(role), is_active = 1`,
    [input.username, stored, input.username, input.role]
  );
}
