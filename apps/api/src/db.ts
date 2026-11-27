import pg from "pg";
import { readFileSync } from "node:fs";
export function createPool(
  connectionString = process.env.DATABASE_URL ??
    "postgres://demo:demo@localhost:55432/possandbox",
) {
  return new pg.Pool({
    connectionString,
    max: 8,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10_000,
  });
}
export const migration = readFileSync(
  new URL("../../../db/migrations/001_sales.sql", import.meta.url),
  "utf8",
);
