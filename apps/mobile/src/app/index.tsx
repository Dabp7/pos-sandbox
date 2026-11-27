import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { catalog } from "../../../../packages/contracts/sale";
import { usePos } from "../application/PosProvider";
import { Button, Card, Navigation, styles } from "../components/ui";
import { calculateLine, calculateTotals, money } from "../domain/money";
export default function Checkout() {
  const pos = usePos();
  const totals = calculateTotals(
    pos.cart.map((line) =>
      calculateLine({ ...line, discountBps: pos.discount * 100 }),
    ),
  );
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>VENTAS QUE SIGUEN CONTIGO</Text>
      <Text style={styles.title}>Una venta. Incluso sin conexión.</Text>
      <Text style={styles.subtitle}>
        Catálogo ficticio, pagos e impresión simulados. Primero guardamos en el
        dispositivo; después confirmamos la entrega.
      </Text>
      <Navigation />
      {pos.loading ? (
        <ActivityIndicator accessibilityLabel="Abriendo base de datos" />
      ) : null}
      <Text style={styles.badge}>
        {pos.offline
          ? "Modo demo sin red · ventas locales"
          : "Sincronización automática cada 10 segundos"}
      </Text>
      <Card>
        <Text style={styles.heading}>Catálogo</Text>
        {catalog.map((product) => (
          <View key={product.id} style={styles.row}>
            <View>
              <Text style={styles.heading}>{product.name}</Text>
              <Text style={styles.subtitle}>{money(product.priceMinor)}</Text>
            </View>
            <Button
              title={`Agregar ${product.name}`}
              onPress={() => pos.add(product.id)}
              disabled={pos.loading || pos.uncertain}
              secondary
            />
          </View>
        ))}
      </Card>
      <Card>
        <Text style={styles.heading}>Carrito</Text>
        {!pos.cart.length ? (
          <Text style={styles.subtitle}>
            Agregue un producto para comenzar.
          </Text>
        ) : (
          pos.cart.map((line) => (
            <View style={styles.row} key={line.product.id}>
              <Text style={styles.subtitle}>
                {line.quantity} × {line.product.name}
              </Text>
              <Button
                title="Quitar"
                onPress={() => pos.remove(line.product.id)}
                disabled={pos.uncertain}
                secondary
              />
            </View>
          ))
        )}
        <Text style={styles.small}>Descuento por línea antes del impuesto</Text>
        <View style={styles.row}>
          {[0, 10, 25].map((percent) => (
            <Button
              title={`${percent}%${pos.discount === percent ? " seleccionado" : ""}`}
              key={percent}
              onPress={() => pos.setDiscount(percent)}
              secondary
              disabled={pos.uncertain}
            />
          ))}
        </View>
        <View style={styles.row}>
          <Text style={styles.subtitle}>Subtotal</Text>
          <Text style={styles.subtitle}>{money(totals.subtotalMinor)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.subtitle}>Descuento</Text>
          <Text style={styles.subtitle}>−{money(totals.discountMinor)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.subtitle}>Impuesto demo 12%</Text>
          <Text style={styles.subtitle}>{money(totals.taxMinor)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.heading}>Total GTQ</Text>
          <Text style={styles.amount}>{money(totals.totalMinor)}</Text>
        </View>
        <Button
          title={
            pos.busy
              ? "Guardando…"
              : pos.uncertain
                ? "Consultar pago y guardar"
                : "Confirmar venta simulada"
          }
          onPress={() => {
            void pos.confirm();
          }}
          disabled={pos.busy || pos.loading || !pos.cart.length}
        />
      </Card>
      {pos.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {pos.error}
        </Text>
      ) : null}
      <Card>
        <Text style={styles.heading}>Último resultado</Text>
        <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
          {pos.message}
        </Text>
      </Card>
      <Text style={styles.small}>
        DEMOSTRACIÓN · Sin cobros reales · Sin validez fiscal. Cierre la app y
        consulte Historial para comprobar la persistencia.
      </Text>
    </ScrollView>
  );
}
