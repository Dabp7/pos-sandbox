import { DatabaseSync } from "node:sqlite";
import type {
  SqlDatabase,
  SqlExecutor,
  Params,
} from "../apps/mobile/src/storage/store";
export function sqlite(path = ":memory:") {
  const raw = new DatabaseSync(path);
  let queue = Promise.resolve<unknown>(undefined);
  const executor: SqlExecutor = {
    run: async (sql, params: Params = []) => ({
      changes: Number(raw.prepare(sql).run(...params).changes),
    }),
    first: async <T>(sql: string, params: Params = []) =>
      (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    all: async <T>(sql: string, params: Params = []) =>
      raw.prepare(sql).all(...params) as T[],
  };
  const db: SqlDatabase = {
    ...executor,
    exec: async (sql) => {
      raw.exec(sql);
    },
    transaction: <T>(body: (sql: SqlExecutor) => Promise<T>) => {
      const result = queue.then(async () => {
        raw.exec("BEGIN IMMEDIATE");
        try {
          const value = await body(executor);
          raw.exec("COMMIT");
          return value;
        } catch (error) {
          raw.exec("ROLLBACK");
          throw error;
        }
      });
      queue = result.catch(() => undefined);
      return result;
    },
  };
  return { db, raw };
}
