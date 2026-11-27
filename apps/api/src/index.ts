import { createPool, migration } from "./db";
import { createApp } from "./app";
const pool = createPool();
await pool.query(migration);
const server = createApp(pool).listen(
  Number(process.env.PORT ?? 4310),
  "0.0.0.0",
  () => console.log("POS API demo: http://localhost:4310 · pagos simulados"),
);
async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
