import { ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { usePos } from "../application/PosProvider";
import { Button, Card, Navigation, styles } from "../components/ui";
import { money } from "../domain/money";
import type { Sale } from "../../../../packages/contracts/sale";
export const stateLabels = {
  pending_sync: "Guardada · pendiente",
  syncing: "Confirmando entrega",
  synced: "Confirmada en servidor",
  failed: "Requiere reintento manual",
};
export default function History() {
  const pos = usePos();
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PERSISTENCIA LOCAL</Text>
      <Text style={styles.title}>Historial de ventas</Text>
      <Navigation />
      <View style={styles.row}>
        <Button
          title="Actualizar historial"
          onPress={() => {
            void pos.refresh();
          }}
          secondary
        />
        <Button
          title="Sincronizar ahora"
          disabled={pos.offline}
          onPress={() => {
            void pos.sync();
          }}
        />
      </View>
      {!pos.sales.length ? (
        <Card>
          <Text style={styles.heading}>Todavía no hay ventas</Text>
          <Text style={styles.subtitle}>
            Las ventas confirmadas aparecen aquí, incluso sin internet.
          </Text>
        </Card>
      ) : (
        pos.sales.map((saved) => {
          const sale = JSON.parse(saved.payload) as Sale;
          return (
            <Card key={saved.id}>
              <Text style={styles.badge}>{stateLabels[saved.state]}</Text>
              <Text style={styles.amount}>{money(sale.totalMinor)}</Text>
              <Text style={styles.small}>
                {new Date(saved.created_at).toLocaleString()}
              </Text>
              <Text style={styles.small}>{saved.id}</Text>
              <Text style={styles.small}>
                Impresión:{" "}
                {saved.last_print_result === "printed"
                  ? "correcta"
                  : (saved.last_print_result ?? "sin intentos")}{" "}
                · intentos: {saved.print_count ?? 0}
              </Text>
              {saved.last_error ? (
                <Text style={styles.error}>{saved.last_error}</Text>
              ) : null}
              <Link
                href={{ pathname: "/sale/[id]", params: { id: saved.id } }}
                style={styles.link}
              >
                Ver comprobante y reimprimir
              </Link>
              {saved.state !== "synced" ? (
                <Button
                  title="Reintentar entrega"
                  onPress={() => {
                    void pos.retry(saved.id);
                  }}
                  secondary
                  disabled={pos.offline}
                />
              ) : null}
            </Card>
          );
        })
      )}
      <Text style={styles.small}>
        Se muestran las últimas 100 ventas. Guardada, impresa y sincronizada son
        estados diferentes.
      </Text>
    </ScrollView>
  );
}
