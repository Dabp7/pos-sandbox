import * as SQLite from "expo-sqlite";
import { SaleStore, type SqlDatabase, type SqlExecutor } from "./store";

export async function openStore(databaseName = "pos-sandbox.db") {
  const db = await SQLite.openDatabaseAsync(databaseName);
  let queue = Promise.resolve<unknown>(undefined);
  function enqueue<T>(body: () => Promise<T>) {
    const task = queue.then(body);
    queue = task.catch(() => undefined);
    return task;
  }
  const wrap = (
    executor: Pick<
      SQLite.SQLiteDatabase,
      "runAsync" | "getFirstAsync" | "getAllAsync"
    >,
  ): SqlExecutor => ({
    run: async (sql, params = []) => executor.runAsync(sql, ...params),
    first: async <T>(sql: string, params: (string | number | null)[] = []) =>
      executor.getFirstAsync<T>(sql, ...params),
    all: async <T>(sql: string, params: (string | number | null)[] = []) =>
      executor.getAllAsync<T>(sql, ...params),
  });
  const raw = wrap(db);
  // All access shares one queue: unrelated async statements cannot enter an active transaction.
  const adapter: SqlDatabase = {
    run: (sql, params) => enqueue(() => raw.run(sql, params)),
    first: <T>(sql: string, params?: (string | number | null)[]) =>
      enqueue(() => raw.first<T>(sql, params)),
    all: <T>(sql: string, params?: (string | number | null)[]) =>
      enqueue(() => raw.all<T>(sql, params)),
    exec: (sql) => enqueue(() => db.execAsync(sql)),
    transaction: <T>(body: (sql: SqlExecutor) => Promise<T>) =>
      enqueue(async () => {
        let result!: T;
        await db.withTransactionAsync(async () => {
          result = await body(wrap(db));
        });
        return result;
      }),
  };
  const store = new SaleStore(adapter);
  await store.migrate();
  return store;
}
