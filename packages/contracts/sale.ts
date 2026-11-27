import { z } from "zod";

export const MoneySchema = z.number().int().min(0).max(1_000_000_000_000);
export const LineSchema = z
  .object({
    productId: z.string().min(1).max(64),
    name: z.string().min(1).max(120),
    quantity: z.number().int().min(1).max(999),
    unitPriceMinor: MoneySchema,
    discountBps: z.number().int().min(0).max(10_000),
    subtotalMinor: MoneySchema,
    discountMinor: MoneySchema,
    taxMinor: MoneySchema,
    totalMinor: MoneySchema,
  })
  .strict();
export const SaleSchema = z
  .object({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    currency: z.literal("GTQ"),
    lines: z.array(LineSchema).min(1).max(100),
    taxBps: z.literal(1200),
    subtotalMinor: MoneySchema,
    discountMinor: MoneySchema,
    taxMinor: MoneySchema,
    totalMinor: MoneySchema,
    paymentReference: z.string().min(1).max(100),
  })
  .strict();
export type Sale = z.infer<typeof SaleSchema>;
export type SaleLine = z.infer<typeof LineSchema>;
export type Product = {
  id: string;
  name: string;
  priceMinor: number;
  currency: "GTQ";
};
export const catalog: Product[] = [
  { id: "coffee", name: "Café de origen", priceMinor: 2850, currency: "GTQ" },
  {
    id: "notebook",
    name: "Cuaderno de ideas",
    priceMinor: 1750,
    currency: "GTQ",
  },
  { id: "cup", name: "Taza del equipo", priceMinor: 3500, currency: "GTQ" },
  { id: "cookie", name: "Galleta artesanal", priceMinor: 725, currency: "GTQ" },
];
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
