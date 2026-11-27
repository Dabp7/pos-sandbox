import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { usePos } from "../../application/PosProvider";
import { Button, Card, Navigation, styles } from "../../components/ui";
import { money } from "../../domain/money";
import type { Sale } from "../../../../../packages/contracts/sale";
export default function SaleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pos = usePos();
  const saved = pos.sales.find((sale) => sale.id === id);
  if (!saved)
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <Navigation />
        <Text style={styles.heading}>
          Venta no encontrada en este dispositivo
        </Text>
      </ScrollView>
    );
  const sale = JSON.parse(saved.payload) as Sale;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>COMPROBANTE DE DEMOSTRACIÓN</Text>
      <Text style={styles.title}>La misma venta, siempre.</Text>
      <Navigation />
      <Card>
        <Text style={styles.small}>{sale.id}</Text>
        <Text style={styles.small}>{sale.createdAt}</Text>
        {sale.lines.map((line, index) => (
          <View style={styles.row} key={index}>
            <View>
              <Text style={styles.heading}>{line.name}</Text>
              <Text style={styles.small}>
                {line.quantity} × {money(line.unitPriceMinor)} · descuento{" "}
                {line.discountBps / 100}%
              </Text>
            </View>
            <Text style={styles.subtitle}>{money(line.totalMinor)}</Text>
          </View>
        ))}
        <Text style={styles.subtitle}>
          Descuento: {money(sale.discountMinor)}
        </Text>
        <Text style={styles.subtitle}>
          Impuesto demo: {money(sale.taxMinor)}
        </Text>
        <Text style={styles.amount}>Total {money(sale.totalMinor)}</Text>
        <Text style={styles.small}>
          Pago simulado · {sale.paymentReference}
        </Text>
        <Button
          title="Reimprimir copia simulada"
          onPress={() => {
            void pos.print(sale, true);
          }}
          secondary
        />
      </Card>
      {pos.error ? <Text style={styles.error}>{pos.error}</Text> : null}
      <Text style={styles.subtitle}>{pos.message}</Text>
      <Text style={styles.small}>
        La reimpresión usa el snapshot guardado; no crea ventas ni pagos.
      </Text>
    </ScrollView>
  );
}
