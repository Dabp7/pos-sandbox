import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SaleStore } from "../apps/mobile/src/storage/store";
import { buildSale } from "../apps/mobile/src/domain/money";
import { catalog } from "../packages/contracts/sale";
import { sqlite } from "./sqlite-adapter";
const sale = () =>
  buildSale(
    randomUUID(),
    [{ product: catalog[0], quantity: 1, discountBps: 1000 }],
    "sim",
  );
const handles: ReturnType<typeof sqlite>[] = [];
afterEach(() => {
  handles.splice(0).forEach((handle) => {
    try {
      handle.raw.close();
    } catch {}
  });
});
async function create() {
  const handle = sqlite();
  handles.push(handle);
  const store = new SaleStore(handle.db);
  await store.migrate();
  return { store, ...handle };
}
describe("SQLite real y outbox", () => {
  it("doble confirmación concurrente guarda una venta y una intención", async () => {
    const { store, raw } = await create();
    const snapshot = sale();
    await Promise.all([store.save(snapshot), store.save(snapshot)]);
    expect(await store.list()).toHaveLength(1);
    expect(raw.prepare("SELECT count(*) AS n FROM sync_outbox").get()?.n).toBe(
      1,
    );
    await expect(
      store.save({ ...snapshot, paymentReference: "different" }),
    ).rejects.toThrow("UUID");
  });
  it("un fallo entre venta y outbox revierte ambas", async () => {
    const { store, raw } = await create();
    raw.exec(
      "CREATE TRIGGER force_failure BEFORE INSERT ON sync_outbox BEGIN SELECT RAISE(ABORT,'simulated'); END;",
    );
    await expect(store.save(sale())).rejects.toThrow("simulated");
    expect(await store.list()).toHaveLength(0);
    expect(raw.prepare("SELECT count(*) AS n FROM sale_lines").get()?.n).toBe(
      0,
    );
  });
  it("conserva venta al cerrar y reabrir el archivo SQLite", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pos-persistence-"));
    const file = join(dir, "sales.db");
    const first = sqlite(file);
    const snapshot = sale();
    const original = new SaleStore(first.db);
    await original.migrate();
    await original.save(snapshot);
    first.raw.close();
    const reopened = sqlite(file);
    const restored = new SaleStore(reopened.db);
    expect((await restored.list())[0].id).toBe(snapshot.id);
    reopened.raw.close();
    await rm(dir, { recursive: true, force: true });
  });
  it("recupera lease vencido y rechaza la confirmación del worker antiguo", async () => {
    const { store } = await create();
    await store.save(sale());
    const first = (await store.claim(1000, "old", 100))!;
    expect(await store.claim(1050, "other")).toBeNull();
    const second = (await store.claim(1101, "new", 100))!;
    expect(second.token).toBe(first.token + 1);
    expect(await store.settle(first, true, "", 1102)).toBe(false);
    expect(await store.settle(second, true, "", 1102)).toBe(true);
    expect((await store.list())[0].state).toBe("synced");
  });
  it("la impresión fallida no elimina ni duplica la venta", async () => {
    const { store, raw } = await create();
    const snapshot = sale();
    await store.save(snapshot);
    await store.recordPrint(snapshot.id, "sin papel", false);
    await store.recordPrint(snapshot.id, "printed", true);
    expect(await store.list()).toHaveLength(1);
    expect(
      raw.prepare("SELECT count(*) AS n FROM print_attempts").get()?.n,
    ).toBe(2);
  });
  it("un cierre en el último intento sale de syncing y permite recuperación manual", async () => {
    const { store, raw } = await create();
    const snapshot = sale();
    await store.save(snapshot);
    raw.prepare("UPDATE sync_outbox SET attempt=7").run();
    const last = (await store.claim(1000, "crashed", 100))!;
    expect(last.attempt).toBe(8);
    expect(await store.claim(1101, "next")).toBeNull();
    expect((await store.list())[0].state).toBe("failed");
    await store.retry(snapshot.id);
    expect((await store.claim(Date.now(), "manual"))?.attempt).toBe(1);
  });
});
