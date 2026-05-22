import mysql from 'mysql2/promise';

/**
 * Build the MySQL connection config from env, or `null` when it isn't
 * configured (e.g. local dev without `DB_*` vars).
 */
function dbConfig(): mysql.ConnectionOptions | null {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) return null;
  return {
    host: DB_HOST,
    port: DB_PORT ? Number(DB_PORT) : 3306,
    user: DB_USER,
    password: DB_PASSWORD ?? '',
    database: DB_NAME,
    connectTimeout: 10_000,
  };
}

/** Whether the database env is configured at all. */
export function isDbConfigured(): boolean {
  return dbConfig() !== null;
}

/**
 * Open a short-lived connection for a single request, or `null` if the DB env
 * is unset. The caller MUST close it (`await conn.end()`).
 *
 * A fresh connection per request (rather than a long-lived pool) avoids the
 * stale-connection failures you get against a remote MySQL behind a firewall
 * that drops idle TCP — the pool would otherwise hand out a dead socket, hang,
 * then 500. Write/read volume for the share feature is low, so the ~80 ms
 * connect cost is fine.
 */
export async function getDbConnection(): Promise<mysql.Connection | null> {
  const cfg = dbConfig();
  if (!cfg) return null;
  return mysql.createConnection(cfg);
}
