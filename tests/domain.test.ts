import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  buildSale,
  calculateLine,
  halfUpBps,
  validateSale,
} from "../apps/mobile/src/domain/money";
import {
  selectPrinter,
  SimulatedPaymentDevice,
} from "../apps/mobile/src/devices/simulators";
import { catalog } from "../packages/contracts/sale";
describe("reglas monetarias y dispositivos", () => {
  it("aplica descuento una sola vez y redondea half-up por línea", () => {
    expect(halfUpBps(5, 1000)).toBe(1);
    const sale = buildSale(
      randomUUID(),
      [{ product: catalog[0], quantity: 2, discountBps: 1000 }],
      "sim",
    );
    expect(sale).toMatchObject({
      subtotalMinor: 5700,
      discountMinor: 570,
      taxMinor: 616,
      totalMinor: 5746,
    });
    expect(validateSale(JSON.parse(JSON.stringify(sale)))).toEqual(sale);
    expect(() => validateSale({ ...sale, totalMinor: 5745 })).toThrow();
  });
  it("valida cantidades, monedas, precisión e importes", () => {
    for (const quantity of [0, -1, 1.5, 1000])
      expect(() =>
        calculateLine({ product: catalog[0], quantity, discountBps: 0 }),
      ).toThrow();
    expect(() => halfUpBps(100, 10_001)).toThrow();
    expect(() =>
      calculateLine({
        product: { ...catalog[0], currency: "USD" as "GTQ" },
        quantity: 1,
        discountBps: 0,
      }),
    ).toThrow();
    expect(() => halfUpBps(Number.MAX_SAFE_INTEGER, 100)).toThrow();
  });
  it("mantiene la referencia al resolver un pago incierto", async () => {
    const device = new SimulatedPaymentDevice();
    device.mode = "uncertain";
    const result = await device.authorize("sale-1", 100);
    expect(result.state).toBe("uncertain");
    expect(await device.getStatus("sale-1")).toEqual({
      state: "approved",
      reference: result.reference,
    });
    expect(await device.authorize("sale-1", 100)).toEqual({
      state: "approved",
      reference: result.reference,
    });
    await expect(device.authorize("sale-1", 101)).rejects.toThrow("otro importe");
  });
  it("normaliza fabricantes y reimprime sin recalcular el snapshot", async () => {
    const sale = buildSale(
      randomUUID(),
      [{ product: catalog[2], quantity: 1, discountBps: 2500 }],
      "sim",
    );
    for (const manufacturer of ["Topwise", "TOPWISE", " topwise "])
      expect(selectPrinter(manufacturer).getCapabilities()).toContain(
        "simulated-receipt",
      );
    const printer = selectPrinter("TOPWISE");
    printer.failNext = true;
    await expect(printer.print(sale, false)).rejects.toThrow("papel");
    expect(await printer.print(sale, true)).toContain("COPIA");
    await expect(selectPrinter("unknown").print(sale, false)).rejects.toThrow(
      "sin adaptador",
    );
  });
});
