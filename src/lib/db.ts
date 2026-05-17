import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;
let resolved = false;

/**
 * Shared MySQL connection pool, or `null` when the database env is not
 * configured (e.g. local dev without `DB_*` vars). Callers MUST handle the
 * null case gracefully — features that depend on the DB should degrade
 * instead of crashing.
 */
export function getDbPool(): mysql.Pool | null {
  if (resolved) return pool;
  resolved = true;

  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) return null;

  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT ? Number(DB_PORT) : 3306,
    user: DB_USER,
    password: DB_PASSWORD ?? '',
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 5,
    idleTimeout: 60_000,
    enableKeepAlive: true,
  });
  return pool;
}
