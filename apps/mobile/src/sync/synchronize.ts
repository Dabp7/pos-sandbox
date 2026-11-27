import { canonicalJson } from "../../../../packages/contracts/sale";
import { validateSale } from "../domain/money";
import type { SaleStore } from "../storage/store";
export type Transport = (url: string, init?: RequestInit) => Promise<Response>;
export async function synchronize(
  store: SaleStore,
  baseUrl: string,
  owner: string,
  transport: Transport = fetch,
  dropResponse = false,
) {
  let processed = 0;
  for (let index = 0; index < 20; index++) {
    const job = await store.claim(Date.now(), owner);
    if (!job) break;
    try {
      const response = await transport(`${baseUrl}/api/sales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": job.id,
          ...(dropResponse ? { "X-Demo-Drop-Response": "once" } : {}),
        },
        body: job.payload,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok)
        throw new Error(`Servidor respondió ${response.status}`);
      const remote = validateSale(await response.json());
      if (canonicalJson(remote) !== job.payload)
        throw new Error("El resultado remoto difiere del comprobante local");
      await store.settle(job, true);
      processed++;
    } catch (error) {
      // A timeout is uncertain: lookup the stable UUID before a later idempotent POST.
      try {
        const confirmation = await transport(`${baseUrl}/api/sales/${job.id}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!confirmation.ok) throw new Error("Sin confirmación remota");
        const remote = validateSale(await confirmation.json());
        if (canonicalJson(remote) !== job.payload)
          throw new Error("Conflicto de venta remota");
        await store.settle(job, true);
        processed++;
      } catch {
        await store.settle(
          job,
          false,
          error instanceof Error ? error.message : "Sin conexión",
        );
      }
    }
  }
  return processed;
}
