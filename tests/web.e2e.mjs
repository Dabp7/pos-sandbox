import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? "@playwright/test",
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  ...(process.env.POS_RECORD_VIDEO === "1"
    ? { recordVideo: { dir: ".data/web-video", size: { width: 390, height: 844 } } }
    : {}),
});
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
try {
  await page.route("**/api/**", (route) => route.abort("failed"));
  await page.goto("http://localhost:4311", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Agregar Café de origen" }).waitFor();
  await page.screenshot({ path: "docs/evidence/pos-home.png" });
  await page.getByRole("link", { name: "Simuladores", exact: true }).click();
  await page.getByRole("switch", { name: "Simular modo sin red" }).click();
  await page.getByRole("link", { name: "Venta", exact: true }).click();
  await page.getByRole("button", { name: "Agregar Café de origen" }).click();
  await page.getByRole("button", { name: "Agregar Café de origen" }).click();
  await page.getByRole("button", { name: "10%" }).click();
  await page.getByText("Total GTQ", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/evidence/pos-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirmar venta simulada" }).click();
  await page
    .getByText(/DEMO SIN VALIDEZ FISCAL/)
    .filter({ visible: true })
    .first()
    .waitFor();
  await page.getByRole("link", { name: "Historial", exact: true }).click();
  await page
    .getByText("Guardada · pendiente", { exact: true })
    .filter({ visible: true })
    .first()
    .waitFor();
  const id = (await page.locator("body").innerText()).match(
    /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  )?.[0];
  assert(id, "Debe mostrarse UUID de la venta guardada");
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByText(id, { exact: true })
    .filter({ visible: true })
    .first()
    .waitFor();
  await page.getByRole("link", { name: "Simuladores", exact: true }).click();
  await page.getByRole("switch", { name: "Simular modo sin red" }).click();
  await page.getByLabel("Fabricante", { exact: true }).fill("TOPWISE");
  await page.getByRole("switch", { name: "Fallar próxima impresión" }).click();
  await page.getByRole("link", { name: "Historial", exact: true }).click();
  await page
    .getByRole("link", { name: "Ver comprobante y reimprimir" })
    .click();
  await page.getByRole("button", { name: "Reimprimir copia simulada" }).click();
  await page
    .getByText(/Impresora simulada sin papel/)
    .filter({ visible: true })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Reimprimir copia simulada" }).click();
  await page
    .getByText(/COPIA · DEMO SIN VALIDEZ FISCAL/)
    .filter({ visible: true })
    .first()
    .waitFor();
  assert(
    (await page.locator("body").innerText()).includes("Q 57.46"),
    "El snapshot debe conservar el total",
  );
  await page.getByRole("link", { name: "Simuladores", exact: true }).click();
  await page
    .getByRole("switch", { name: "Perder respuesta tras guardar" })
    .click();
  await page.unroute("**/api/**");
  await page.getByRole("switch", { name: "Simular modo sin red" }).click();
  await page.getByRole("link", { name: "Historial", exact: true }).click();
  await page
    .getByText("Confirmada en servidor", { exact: true })
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 20_000 });
  const remote = await fetch(`http://localhost:4310/api/sales/${id}`).then(
    (response) => response.json(),
  );
  assert.equal(remote.totalMinor, 5746);
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert(
    width.scroll <= width.client,
    "No debe haber scroll horizontal a 390px",
  );
  assert.deepEqual(failures, [], "No debe haber errores de JavaScript");
  console.log(
    JSON.stringify({
      ok: true,
      viewport: 390,
      sqliteReload: true,
      offlineSale: true,
      printerFailure: true,
      reprintCopy: true,
      synced: true,
      saleId: id,
      totalMinor: remote.totalMinor,
      pageErrors: failures,
    }),
  );
} catch (error) {
  console.error((await page.locator("body").innerText()).slice(0, 4000));
  console.error(error);
  throw error;
} finally {
  const video = page.video();
  if (video) {
    await page.context().close();
    await video.saveAs("docs/evidence/pos-demo-web.webm");
  }
  await browser.close();
}
