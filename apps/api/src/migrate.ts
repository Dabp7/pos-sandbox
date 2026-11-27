import { createPool, migration } from "./db";
const pool = createPool();
try {
  await pool.query(migration);
  console.log("Migración PostgreSQL aplicada");
} finally {
  await pool.end();
}
