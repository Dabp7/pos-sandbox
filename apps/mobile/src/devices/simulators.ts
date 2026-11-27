import type { Sale } from "../../../../packages/contracts/sale";
export type PaymentState = "approved" | "declined" | "uncertain";
export interface PaymentDevice {
  capabilities: readonly string[];
  authorize(
    key: string,
    amountMinor: number,
  ): Promise<{ state: PaymentState; reference: string }>;
  getStatus(key: string): Promise<{ state: PaymentState; reference: string }>;
}
export interface ReceiptPrinter {
  getCapabilities(): readonly string[];
  print(sale: Sale, copy: boolean): Promise<string>;
}
export class SimulatedPaymentDevice implements PaymentDevice {
  capabilities = ["simulated-payment", "status-lookup"] as const;
  mode: PaymentState = "approved";
  private results = new Map<
    string,
    { state: PaymentState; reference: string }
  >();
  private amounts = new Map<string, number>();
  async authorize(key: string, amountMinor: number) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0)
      throw new Error("Importe inválido");
    const previous = this.results.get(key);
    if (previous) {
      if (this.amounts.get(key) !== amountMinor)
        throw new Error("La referencia de pago ya corresponde a otro importe");
      return previous;
    }
    const result = { state: this.mode, reference: `SIM-${key}` };
    this.amounts.set(key, amountMinor);
    this.results.set(key, {
      ...result,
      state: this.mode === "uncertain" ? "approved" : this.mode,
    });
    return result;
  }
  async getStatus(key: string) {
    return (
      this.results.get(key) ?? {
        state: "uncertain" as const,
        reference: `SIM-${key}`,
      }
    );
  }
}
export class SimulatedPrinter implements ReceiptPrinter {
  failNext = false;
  constructor(
    readonly manufacturer: string,
    private supported: boolean,
  ) {}
  getCapabilities() {
    return this.supported ? ["simulated-receipt"] : [];
  }
  async print(sale: Sale, copy: boolean) {
    if (!this.supported)
      throw new Error(
        "Fabricante sin adaptador de impresión; comprobante digital disponible",
      );
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Impresora simulada sin papel");
    }
    return `${copy ? "COPIA · " : ""}DEMO SIN VALIDEZ FISCAL\n${sale.id}\n${sale.lines.map((line) => `${line.quantity} × ${line.name}`).join("\n")}\nGTQ ${(sale.totalMinor / 100).toFixed(2)}\nPAGO SIMULADO`;
  }
}
export function selectPrinter(manufacturer: string) {
  const normalized = manufacturer.trim().toLowerCase();
  return new SimulatedPrinter(
    normalized,
    ["topwise", "sunmi", "simulator"].includes(normalized),
  );
}
