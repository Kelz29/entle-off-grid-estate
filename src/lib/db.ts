import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

declare global {
  var __eoeMysqlPool: Pool | undefined;
}

export type QueryResult<T> = {
  rows: T[];
  rowCount: number;
  insertId?: number;
};

export type DbClient = {
  query: <T = RowDataPacket>(
    text: string,
    params?: unknown[]
  ) => Promise<QueryResult<T>>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Convert Postgres-style $1, $2 placeholders to MySQL ?.
 * Reused indices (e.g. $4 twice) are expanded into repeated values.
 */
export function convertPgQuery(
  text: string,
  params: unknown[] = []
): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const sql = text.replace(/\$(\d+)/g, (_, n: string) => {
    values.push(params[Number(n) - 1]);
    return "?";
  });
  return { sql, values };
}

export function getPool(): Pool {
  if (!global.__eoeMysqlPool) {
    global.__eoeMysqlPool = mysql.createPool({
      host: requireEnv("MYSQL_HOST"),
      port: Number(process.env.MYSQL_PORT || 3306),
      user: requireEnv("MYSQL_USER"),
      password: requireEnv("MYSQL_PASSWORD"),
      database: requireEnv("MYSQL_DATABASE"),
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 10_000,
      enableKeepAlive: true,
      dateStrings: true,
      timezone: "Z",
    });
  }

  return global.__eoeMysqlPool;
}

async function runQuery<T>(
  executor: {
    query: (
      sql: string,
      values?: unknown[]
    ) => Promise<[RowDataPacket[] | ResultSetHeader, unknown]>;
  },
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const { sql, values } = convertPgQuery(text, params);
  const [result] = await executor.query(sql, values);

  if (Array.isArray(result)) {
    return {
      rows: result as T[],
      rowCount: result.length,
    };
  }

  const header = result as ResultSetHeader;
  return {
    rows: [] as T[],
    rowCount: header.affectedRows,
    insertId: header.insertId,
  };
}

/** pg-compatible query helper used by calendly repository / bookings. */
export async function query<T = RowDataPacket>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return runQuery<T>(getPool(), text, params);
}

export async function withTransaction<T>(
  fn: (client: DbClient) => Promise<T>
): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const client: DbClient = {
      query: <R = RowDataPacket>(text: string, params: unknown[] = []) =>
        runQuery<R>(connection, text, params),
    };
    const result = await fn(client);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export type { Pool, PoolConnection, ResultSetHeader, RowDataPacket };
