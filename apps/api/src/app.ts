import { createHash, randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import type pg from "pg";
import { canonicalJson, catalog } from "../../../packages/contracts/sale";
import { validateSale } from "../../mobile/src/domain/money";

export function createApp(
  pool: pg.Pool,
  actorId = process.env.DEMO_ACTOR_ID ?? "demo-cashier",
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: true, exposedHeaders: ["X-Correlation-Id"] }));
  app.use((req, res, next) => {
    res.locals.correlationId = randomUUID();
    res.setHeader("X-Correlation-Id", res.locals.correlationId);
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  app.get("/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok", mode: "demo-only" });
  });
  app.get("/api/catalog", (_req, res) =>
    res.json({ version: "demo-v1", products: catalog }),
  );
  app.get("/api/sales", async (_req, res) => {
    const rows = await pool.query(
      "SELECT payload FROM sales WHERE actor_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100",
      [actorId],
    );
    res.json(rows.rows.map((row) => row.payload));
  });
  app.get("/api/sales/:id", async (req, res) => {
    if (!isUuid(req.params.id))
      return sendError(res, 400, "INVALID_ID", "UUID inválido");
    const result = await pool.query(
      "SELECT payload FROM sales WHERE actor_id=$1 AND id=$2",
      [actorId, req.params.id],
    );
    if (!result.rowCount)
      return sendError(res, 404, "NOT_FOUND", "Venta no encontrada");
    res.json(result.rows[0].payload);
  });
  app.post("/api/sales", async (req, res) => {
    let sale;
    try {
      sale = validateSale(req.body);
    } catch {
      return sendError(
        res,
        400,
        "INVALID_SALE",
        "Comprobante inválido: revise cantidades, moneda e importes",
      );
    }
    if (req.get("Idempotency-Key") !== sale.id)
      return sendError(
        res,
        400,
        "INVALID_KEY",
        "Idempotency-Key debe coincidir con el UUID de venta",
      );
    const hash = createHash("sha256").update(canonicalJson(sale)).digest("hex");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO sales(actor_id,id,payload_hash,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(actor_id,id) DO NOTHING RETURNING id",
        [actorId, sale.id, hash, JSON.stringify(sale)],
      );
      const existing = await client.query(
        "SELECT payload_hash,payload FROM sales WHERE actor_id=$1 AND id=$2",
        [actorId, sale.id],
      );
      if (existing.rows[0].payload_hash !== hash) {
        await client.query("ROLLBACK");
        return sendError(
          res,
          409,
          "IDEMPOTENCY_CONFLICT",
          "El UUID ya corresponde a otro comprobante",
        );
      }
      await client.query("COMMIT");
      // Failure injection deliberately happens AFTER durable commit and only on the initial insert.
      if (inserted.rowCount && req.get("X-Demo-Drop-Response") === "once") {
        res.socket?.destroy();
        return;
      }
      res.status(inserted.rowCount ? 201 : 200).json(existing.rows[0].payload);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });
  app.use((_req, res) =>
    sendError(res, 404, "NOT_FOUND", "Ruta no encontrada"),
  );
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status =
      typeof error?.status === "number" &&
      error.status >= 400 &&
      error.status < 500
        ? error.status
        : 503;
    sendError(
      res,
      status,
      status < 500 ? "INVALID_REQUEST" : "SERVICE_UNAVAILABLE",
      status < 500
        ? "Solicitud inválida"
        : "Servicio temporalmente no disponible",
    );
  };
  app.use(errors);
  return app;
}
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
function sendError(
  res: express.Response,
  status: number,
  code: string,
  message: string,
) {
  return res
    .status(status)
    .json({ code, message, correlationId: res.locals.correlationId });
}
