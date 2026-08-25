import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/** Lightweight prod diagnostic — does not expose secrets. */
export async function GET() {
  const started = Date.now();
  const env = {
    mysql_host: Boolean(process.env.MYSQL_HOST),
    mysql_user: Boolean(process.env.MYSQL_USER),
    mysql_database: Boolean(process.env.MYSQL_DATABASE),
    mysql_password: Boolean(process.env.MYSQL_PASSWORD),
  };

  if (!env.mysql_host || !env.mysql_user || !env.mysql_database || !env.mysql_password) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_mysql_env",
        env,
        ms: Date.now() - started,
      },
      { status: 503 }
    );
  }

  try {
    const { rows } = await query<{ id: number; name: string }>(
      `SELECT id, name FROM businesses WHERE is_active = true ORDER BY id LIMIT 1`
    );
    return NextResponse.json({
      ok: true,
      business: rows[0] ?? null,
      env,
      ms: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "db_error";
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : undefined;
    return NextResponse.json(
      {
        ok: false,
        error: "db_unreachable",
        message,
        code,
        env,
        ms: Date.now() - started,
      },
      { status: 503 }
    );
  }
}
