import { canonicalJson, type Sale } from "../../../../packages/contracts/sale";
export type Params = (string | number | null)[];
export interface SqlExecutor {
  run(sql: string, params?: Params): Promise<{ changes: number }>;
  first<T>(sql: string, params?: Params): Promise<T | null>;
  all<T>(sql: string, params?: Params): Promise<T[]>;
}
export interface SqlDatabase extends SqlExecutor {
  exec(sql: string): Promise<void>;
  transaction<T>(body: (sql: SqlExecutor) => Promise<T>): Promise<T>;
}
export type SaleState = "pending_sync" | "syncing" | "synced" | "failed";
export type SavedSale = {
  id: string;
  state: SaleState;
  payload: string;
  created_at: string;
  last_error: string | null;
  print_count?: number;
  last_print_result?: string | null;
};
export type ClaimedSale = SavedSale & {
  attempt: number;
  token: number;
  lease_owner: string;
};
export const migration = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, name TEXT NOT NULL, price_minor INTEGER NOT NULL, currency TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sales(id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('pending_sync','syncing','synced','failed')), payload TEXT NOT NULL, created_at TEXT NOT NULL, last_error TEXT);
CREATE TABLE IF NOT EXISTS sale_lines(sale_id TEXT NOT NULL REFERENCES sales(id), line_index INTEGER NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY(sale_id,line_index));
CREATE TABLE IF NOT EXISTS sync_outbox(sale_id TEXT PRIMARY KEY REFERENCES sales(id), attempt INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, lease_owner TEXT, next_attempt_at INTEGER NOT NULL DEFAULT 0, token INTEGER NOT NULL DEFAULT 0, payload_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS print_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id TEXT NOT NULL REFERENCES sales(id), result TEXT NOT NULL, is_copy INTEGER NOT NULL, at TEXT NOT NULL);
PRAGMA user_version=1;`;

export class SaleStore {
  constructor(readonly db: SqlDatabase) {}
  async migrate() {
    await this.db.exec(migration);
  }
  async save(sale: Sale) {
    const payload = canonicalJson(sale);
    return this.db.transaction(async (sql) => {
      const existing = await sql.first<SavedSale>(
        "SELECT * FROM sales WHERE id=?",
        [sale.id],
      );
      if (existing) {
        if (existing.payload !== payload)
          throw new Error("UUID reutilizado para una venta diferente");
        return existing;
      }
      await sql.run(
        "INSERT INTO sales(id,state,payload,created_at) VALUES(?,?,?,?)",
        [sale.id, "pending_sync", payload, sale.createdAt],
      );
      for (const [index, line] of sale.lines.entries())
        await sql.run(
          "INSERT INTO sale_lines(sale_id,line_index,snapshot) VALUES(?,?,?)",
          [sale.id, index, JSON.stringify(line)],
        );
      // Immutable canonical payload is the collision-free comparison value; no weak hash in the local database.
      await sql.run(
        "INSERT INTO sync_outbox(sale_id,payload_hash) VALUES(?,?)",
        [sale.id, payload],
      );
      return (await sql.first<SavedSale>("SELECT * FROM sales WHERE id=?", [
        sale.id,
      ]))!;
    });
  }
  async list() {
    return this.db.all<SavedSale>(
      "SELECT s.*, (SELECT count(*) FROM print_attempts p WHERE p.sale_id=s.id) AS print_count, (SELECT result FROM print_attempts p WHERE p.sale_id=s.id ORDER BY p.id DESC LIMIT 1) AS last_print_result FROM sales s ORDER BY s.created_at DESC, s.id DESC LIMIT 100",
    );
  }
  async claim(
    now: number,
    owner: string,
    leaseMs = 30_000,
  ): Promise<ClaimedSale | null> {
    return this.db.transaction(async (sql) => {
      await sql.run(
        "UPDATE sales SET state='failed',last_error='Se agotaron los intentos; reintente manualmente' WHERE state='syncing' AND id IN (SELECT sale_id FROM sync_outbox WHERE attempt>=8 AND lease_until<=?)",
        [now],
      );
      const row = await sql.first<ClaimedSale>(
        `SELECT s.*,o.attempt,o.token FROM sales s JOIN sync_outbox o ON o.sale_id=s.id WHERE o.attempt<8 AND o.next_attempt_at<=? AND (s.state IN ('pending_sync','failed') OR (s.state='syncing' AND o.lease_until<=?)) ORDER BY s.created_at,s.id LIMIT 1`,
        [now, now],
      );
      if (!row) return null;
      const token = row.token + 1;
      await sql.run(
        "UPDATE sync_outbox SET attempt=attempt+1,lease_owner=?,lease_until=?,token=? WHERE sale_id=?",
        [owner, now + leaseMs, token, row.id],
      );
      await sql.run(
        "UPDATE sales SET state='syncing',last_error=NULL WHERE id=?",
        [row.id],
      );
      return {
        ...row,
        state: "syncing",
        attempt: row.attempt + 1,
        token,
        lease_owner: owner,
      };
    });
  }
  async settle(
    job: ClaimedSale,
    success: boolean,
    error = "",
    now = Date.now(),
  ) {
    return this.db.transaction(async (sql) => {
      const current = await sql.first<{
        token: number;
        lease_owner: string;
        lease_until: number;
      }>(
        "SELECT token,lease_owner,lease_until FROM sync_outbox WHERE sale_id=?",
        [job.id],
      );
      if (
        !current ||
        current.token !== job.token ||
        current.lease_owner !== job.lease_owner ||
        current.lease_until <= now
      )
        return false;
      await sql.run("UPDATE sales SET state=?,last_error=? WHERE id=?", [
        success ? "synced" : job.attempt >= 8 ? "failed" : "pending_sync",
        success ? null : error.slice(0, 300),
        job.id,
      ]);
      if (success)
        await sql.run("DELETE FROM sync_outbox WHERE sale_id=?", [job.id]);
      else
        await sql.run(
          "UPDATE sync_outbox SET lease_until=0,lease_owner=NULL,next_attempt_at=? WHERE sale_id=?",
          [now + Math.min(300_000, 1000 * 2 ** job.attempt), job.id],
        );
      return true;
    });
  }
  async retry(id: string) {
    await this.db.transaction(async (sql) => {
      const row = await sql.first<{ state: SaleState; lease_until: number }>(
        "SELECT s.state,o.lease_until FROM sales s JOIN sync_outbox o ON o.sale_id=s.id WHERE s.id=?",
        [id],
      );
      if (!row || (row.state === "syncing" && row.lease_until > Date.now()))
        return;
      await sql.run(
        "UPDATE sync_outbox SET attempt=0,next_attempt_at=0,lease_until=0,lease_owner=NULL WHERE sale_id=?",
        [id],
      );
      await sql.run(
        "UPDATE sales SET state='pending_sync',last_error=NULL WHERE id=?",
        [id],
      );
    });
  }
  async recordPrint(id: string, result: string, copy: boolean) {
    await this.db.run(
      "INSERT INTO print_attempts(sale_id,result,is_copy,at) VALUES(?,?,?,?)",
      [id, result.slice(0, 300), copy ? 1 : 0, new Date().toISOString()],
    );
  }
}
