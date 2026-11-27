import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createPool, migration } from "../apps/api/src/db";
import { createApp } from "../apps/api/src/app";
import { buildSale } from "../apps/mobile/src/domain/money";
import { catalog } from "../packages/contracts/sale";
import { SaleStore } from "../apps/mobile/src/storage/store";
import { synchronize } from "../apps/mobile/src/sync/synchronize";
import { sqlite } from "./sqlite-adapter";
const connection = process.env.TEST_DATABASE_URL;
describe.skipIf(!connection)("API con PostgreSQL real", () => {
  const actor = `test-${randomUUID()}`;
  const pool = createPool(connection);
  const app = createApp(pool, actor);
  beforeAll(async () => {
    await pool.query(migration);
  });
  afterAll(async () => {
    await pool.query("DELETE FROM sales WHERE actor_id=$1", [actor]);
    await pool.end();
  });
  const make = () =>
    buildSale(
      randomUUID(),
      [{ product: catalog[1], quantity: 3, discountBps: 1000 }],
      "sim",
    );
  it("diez POST simultáneos producen una venta; payload distinto devuelve 409", async () => {
    const sale = make();
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post("/api/sales")
          .set("Idempotency-Key", sale.id)
          .send(sale),
      ),
    );
    expect(
      responses.filter((response) => response.status === 201),
    ).toHaveLength(1);
    expect(
      responses.every((response) => [200, 201].includes(response.status)),
    ).toBe(true);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM sales WHERE actor_id=$1 AND id=$2",
          [actor, sale.id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await request(app)
          .post("/api/sales")
          .set("Idempotency-Key", sale.id)
          .send({ ...sale, paymentReference: "changed" })
      ).status,
    ).toBe(409);
  });
  it("valida moneda, totales, UUID y clave; aísla actores de demo", async () => {
    const sale = make();
    expect(
      (
        await request(app)
          .post("/api/sales")
          .set("Idempotency-Key", sale.id)
          .send({ ...sale, currency: "USD" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/sales")
          .set("Idempotency-Key", sale.id)
          .send({ ...sale, totalMinor: 1 })
      ).status,
    ).toBe(400);
    expect((await request(app).post("/api/sales").send(sale)).status).toBe(400);
    expect((await request(app).get("/api/sales/not-a-uuid")).status).toBe(400);
    await request(app)
      .post("/api/sales")
      .set("Idempotency-Key", sale.id)
      .send(sale);
    expect(
      (
        await request(createApp(pool, "another-demo-actor")).get(
          `/api/sales/${sale.id}`,
        )
      ).status,
    ).toBe(404);
  });
  it("respuesta perdida tras commit termina con una venta y outbox confirmada", async () => {
    const handle = sqlite();
    const store = new SaleStore(handle.db);
    await store.migrate();
    const sale = make();
    await store.save(sale);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as { port: number };
    try {
      expect(
        await synchronize(
          store,
          `http://127.0.0.1:${address.port}`,
          "test-worker",
          fetch,
          true,
        ),
      ).toBe(1);
      expect((await store.list())[0].state).toBe("synced");
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM sales WHERE actor_id=$1 AND id=$2",
            [actor, sale.id],
          )
        ).rows[0].n,
      ).toBe(1);
    } finally {
      handle.raw.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
