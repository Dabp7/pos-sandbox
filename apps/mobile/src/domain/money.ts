import {
  SaleSchema,
  type Product,
  type Sale,
  type SaleLine,
} from "../../../../packages/contracts/sale";

export type CartLine = {
  product: Product;
  quantity: number;
  discountBps: number;
};
const safe = (value: number, max = 1_000_000_000_000) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw new Error("Importe o porcentaje fuera de rango");
  return value;
};
export function halfUpBps(amount: number, bps: number) {
  safe(amount);
  safe(bps, 10_000);
  return Number((BigInt(amount) * BigInt(bps) + 5000n) / 10000n);
}
export function calculateLine({
  product,
  quantity,
  discountBps,
}: CartLine): SaleLine {
  if (product.currency !== "GTQ") throw new Error("Moneda no admitida");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999)
    throw new Error("Cantidad entre 1 y 999");
  const subtotalMinor = safe(safe(product.priceMinor) * quantity);
  const discountMinor = halfUpBps(subtotalMinor, discountBps);
  const taxMinor = halfUpBps(subtotalMinor - discountMinor, 1200);
  return {
    productId: product.id,
    name: product.name,
    quantity,
    unitPriceMinor: product.priceMinor,
    discountBps,
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor: safe(subtotalMinor - discountMinor + taxMinor),
  };
}
export function calculateTotals(lines: SaleLine[]) {
  return lines.reduce(
    (sum, line) => ({
      subtotalMinor: safe(sum.subtotalMinor + line.subtotalMinor),
      discountMinor: safe(sum.discountMinor + line.discountMinor),
      taxMinor: safe(sum.taxMinor + line.taxMinor),
      totalMinor: safe(sum.totalMinor + line.totalMinor),
    }),
    { subtotalMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: 0 },
  );
}
export function buildSale(
  id: string,
  cart: CartLine[],
  paymentReference: string,
  createdAt = new Date().toISOString(),
): Sale {
  const lines = cart.map(calculateLine);
  return SaleSchema.parse({
    id,
    createdAt,
    currency: "GTQ",
    lines,
    taxBps: 1200,
    ...calculateTotals(lines),
    paymentReference,
  });
}
export function validateSale(value: unknown): Sale {
  const sale = SaleSchema.parse(value);
  const lines = sale.lines.map((line) =>
    calculateLine({
      product: {
        id: line.productId,
        name: line.name,
        priceMinor: line.unitPriceMinor,
        currency: sale.currency,
      },
      quantity: line.quantity,
      discountBps: line.discountBps,
    }),
  );
  for (let index = 0; index < lines.length; index++) {
    for (const field of [
      "subtotalMinor",
      "discountMinor",
      "taxMinor",
      "totalMinor",
    ] as const) {
      if (lines[index][field] !== sale.lines[index][field])
        throw new Error("Los importes del comprobante no coinciden");
    }
  }
  const totals = calculateTotals(lines);
  for (const field of [
    "subtotalMinor",
    "discountMinor",
    "taxMinor",
    "totalMinor",
  ] as const) {
    if (totals[field] !== sale[field])
      throw new Error("Los totales no coinciden");
  }
  return sale;
}
export const money = (minor: number) => `Q ${(minor / 100).toFixed(2)}`;
