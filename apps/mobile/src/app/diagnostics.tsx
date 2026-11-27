import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { openStore } from "../storage/expo";
import { buildSale } from "../domain/money";
import { catalog } from "../../../../packages/contracts/sale";
import { selectPrinter } from "../devices/simulators";
import { synchronize } from "../sync/synchronize";
import { styles } from "../components/ui";

// Development-only harness for process-death verification on the actual native SQLite adapter.
const evidenceId = "1c2d3e4f-5060-4789-8abc-def012345678";
export default function Diagnostics() {
  const { phase } = useLocalSearchParams<{ phase: string }>();
  const [result, setResult] = useState(
    __DEV__
      ? "Ejecutando comprobación nativa…"
      : "Diagnóstico disponible solo en desarrollo",
  );
  useEffect(() => {
    if (!__DEV__) return;
    let cancelled = false;
    async function run() {
      const store = await openStore("pos-native-evidence.db");
      if (phase === "save") {
        const snapshot = buildSale(
          evidenceId,
          [{ product: catalog[0], quantity: 2, discountBps: 1000 }],
          "SIM-NATIVE-CHECK",
          "2026-11-26T12:00:00.000Z",
        );
        await store.save(snapshot);
        const rows = await store.list();
        if (rows.length !== 1 || rows[0].id !== evidenceId)
          throw new Error("Persistencia inicial inválida");
        return {
          phase,
          sqlite: "native",
          persisted: true,
          saleId: evidenceId,
          totalMinor: snapshot.totalMinor,
        };
      }
      const rows = await store.list();
      if (rows.length !== 1 || rows[0].id !== evidenceId)
        throw new Error("La venta no sobrevivió al cierre de proceso");
      const snapshot = JSON.parse(rows[0].payload);
      if (snapshot.totalMinor !== 5746)
        throw new Error("El snapshot cambió al reiniciar");
      if (phase === "read") {
        const printer = selectPrinter("TOPWISE");
        printer.failNext = true;
        try {
          await printer.print(snapshot, false);
          throw new Error("La simulación de fallo no ocurrió");
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("papel"))
            throw error;
          await store.recordPrint(evidenceId, "sin papel", false);
        }
        const copy = await printer.print(snapshot, true);
        if (!copy.startsWith("COPIA"))
          throw new Error("Falta etiqueta de copia");
        await store.recordPrint(evidenceId, "printed", true);
        if ((await store.list()).length !== 1)
          throw new Error("Imprimir duplicó la venta");
        return {
          phase,
          sqlite: "native",
          survivedProcessDeath: true,
          printFailurePreservesSale: true,
          copy: true,
          totalMinor: snapshot.totalMinor,
        };
      }
      if (phase === "sync") {
        await store.retry(evidenceId);
        const count = await synchronize(
          store,
          process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:4310",
          "native-check",
          fetch,
          true,
        );
        if (count !== 1 || (await store.list())[0].state !== "synced")
          throw new Error("La venta no se confirmó tras perder respuesta");
        return {
          phase,
          sqlite: "native",
          responseLostAfterCommit: true,
          synced: true,
          saleId: evidenceId,
        };
      }
      throw new Error("Use phase=save, read o sync");
    }
    void run()
      .then((value) => {
        const text = JSON.stringify({ ok: true, ...value });
        console.log(`POS_NATIVE_EVIDENCE ${text}`);
        if (!cancelled) setResult(text);
      })
      .catch((error) => {
        const text = JSON.stringify({ ok: false, phase, error: String(error) });
        console.log(`POS_NATIVE_EVIDENCE ${text}`);
        if (!cancelled) setResult(text);
      });
    return () => {
      cancelled = true;
    };
  }, [phase]);
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Diagnóstico de desarrollo</Text>
      <Text selectable style={styles.subtitle}>
        {result}
      </Text>
      <Text style={styles.small}>
        Base separada de las ventas de la demo. Sin pagos ni impresoras reales.
      </Text>
    </ScrollView>
  );
}
