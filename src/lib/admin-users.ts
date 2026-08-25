import { query } from "@/lib/db";
import type { AdminRole } from "./admin-roles";
import { isAdminRole } from "./admin-roles";

export type AdminUserRow = {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean | number;
  created_at: string;
  updated_at: string;
};

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

function bufToB64(buf: Buffer): string {
  return buf.toString("base64url");
}

function b64ToBuf(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/** scrypt hash as `scrypt$salt$hash` (Node crypto, no extra deps). */
export async function hashPassword(password: string): Promise<string> {
  const { randomBytes, scrypt } = await import("crypto");
  const { promisify } = await import("util");
  const scryptAsync = promisify(scrypt) as (
    password: string,
    salt: Buffer,
    keylen: number,
    opts: { N: number; r: number; p: number }
  ) => Promise<Buffer>;
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${bufToB64(salt)}$${bufToB64(hash)}`;
}

export async function verifyPasswordHash(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltB64, hashB64] = parts;
  const { scrypt, timingSafeEqual } = await import("crypto");
  const { promisify } = await import("util");
  const scryptAsync = promisify(scrypt) as (
    password: string,
    salt: Buffer,
    keylen: number,
    opts: { N: number; r: number; p: number }
  ) => Promise<Buffer>;
  try {
    const salt = b64ToBuf(saltB64);
    const expected = b64ToBuf(hashB64);
    const actual = await scryptAsync(password, salt, expected.length, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function listAdminUsers(): Promise<
  Omit<AdminUserRow, "password_hash">[]
> {
  const { rows } = await query<AdminUserRow>(
    `SELECT id, username, display_name, role, is_active, created_at, updated_at
       FROM admin_users
      ORDER BY role, username`
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    display_name: r.display_name,
    role: r.role,
    is_active: Boolean(r.is_active),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function findAdminUserByUsername(
  username: string
): Promise<AdminUserRow | null> {
  const { rows } = await query<AdminUserRow>(
    `SELECT * FROM admin_users WHERE username = $1 LIMIT 1`,
    [username.trim().toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function getAdminUser(id: number): Promise<AdminUserRow | null> {
  const { rows } = await query<AdminUserRow>(
    `SELECT * FROM admin_users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createAdminUser(input: {
  username: string;
  password: string;
  displayName: string;
  role: AdminRole;
}): Promise<Omit<AdminUserRow, "password_hash">> {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) {
    throw new Error("Username must be 2 to 40 letters, numbers, . _ or -");
  }
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  if (!isAdminRole(input.role)) throw new Error("Invalid role");
  const hash = await hashPassword(input.password);
  const display = input.displayName.trim() || username;
  await query(
    `INSERT INTO admin_users (username, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4)`,
    [username, hash, display, input.role]
  );
  const created = await findAdminUserByUsername(username);
  if (!created) throw new Error("Could not create user");
  return {
    id: created.id,
    username: created.username,
    display_name: created.display_name,
    role: created.role,
    is_active: Boolean(created.is_active),
    created_at: created.created_at,
    updated_at: created.updated_at,
  };
}

export async function updateAdminUser(
  id: number,
  patch: {
    displayName?: string;
    role?: AdminRole;
    isActive?: boolean;
    password?: string;
  }
): Promise<Omit<AdminUserRow, "password_hash"> | null> {
  const existing = await getAdminUser(id);
  if (!existing) return null;

  const display =
    typeof patch.displayName === "string"
      ? patch.displayName.trim() || existing.display_name
      : existing.display_name;
  const role =
    patch.role && isAdminRole(patch.role) ? patch.role : existing.role;
  const active =
    typeof patch.isActive === "boolean"
      ? patch.isActive
        ? 1
        : 0
      : existing.is_active
        ? 1
        : 0;

  if (patch.password) {
    if (patch.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const hash = await hashPassword(patch.password);
    await query(
      `UPDATE admin_users
          SET display_name = $2, role = $3, is_active = $4, password_hash = $5,
              updated_at = NOW(3)
        WHERE id = $1`,
      [id, display, role, active, hash]
    );
  } else {
    await query(
      `UPDATE admin_users
          SET display_name = $2, role = $3, is_active = $4, updated_at = NOW(3)
        WHERE id = $1`,
      [id, display, role, active]
    );
  }

  const updated = await getAdminUser(id);
  if (!updated) return null;
  return {
    id: updated.id,
    username: updated.username,
    display_name: updated.display_name,
    role: updated.role,
    is_active: Boolean(updated.is_active),
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  };
}

export async function deleteAdminUser(id: number): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM admin_users WHERE id = $1`, [
    id,
  ]);
  return rowCount > 0;
}

export async function changeOwnPassword(input: {
  username: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const user = await findAdminUserByUsername(input.username);
  if (!user || !user.is_active) {
    throw new Error(
      "This account uses the env owner login. Change ADMIN_PASSWORD in the server environment instead."
    );
  }
  const ok = await verifyPasswordHash(
    input.currentPassword,
    user.password_hash
  );
  if (!ok) throw new Error("Current password is incorrect");
  if (input.newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }
  if (input.currentPassword === input.newPassword) {
    throw new Error("New password must be different from the current one");
  }
  const hash = await hashPassword(input.newPassword);
  await query(
    `UPDATE admin_users SET password_hash = $2, updated_at = NOW(3) WHERE id = $1`,
    [user.id, hash]
  );
}

export async function authenticateDbUser(
  username: string,
  password: string
): Promise<{ username: string; role: AdminRole; displayName: string } | null> {
  const user = await findAdminUserByUsername(username);
  if (!user || !user.is_active) return null;
  const ok = await verifyPasswordHash(password, user.password_hash);
  if (!ok) return null;
  return {
    username: user.username,
    role: user.role,
    displayName: user.display_name,
  };
}

