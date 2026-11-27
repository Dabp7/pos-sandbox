import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { usePos } from "../application/PosProvider";
import { Button, Card, Navigation, styles } from "../components/ui";
import type { PaymentState } from "../devices/simulators";
export default function Settings() {
  const pos = usePos();
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>LABORATORIO DE FALLOS</Text>
      <Text style={styles.title}>Simuladores</Text>
      <Navigation />
      <Card>
        <Text style={styles.heading}>Conexión</Text>
        <View style={styles.row}>
          <Text style={styles.subtitle}>Simular modo sin red</Text>
          <Switch
            accessibilityLabel="Simular modo sin red"
            value={pos.offline}
            onValueChange={pos.setOffline}
          />
        </View>
        <Text style={styles.small}>
          Detiene los intentos de sincronización. Para probar falta de internet
          real, use modo avión.
        </Text>
        <Text style={styles.subtitle}>URL de API local</Text>
        <TextInput
          accessibilityLabel="URL de API"
          value={pos.apiUrl}
          onChangeText={pos.setApiUrl}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="url"
        />
        <View style={styles.row}>
          <Text style={styles.subtitle}>Perder respuesta tras guardar</Text>
          <Switch
            accessibilityLabel="Perder respuesta tras guardar"
            value={pos.drop}
            onValueChange={pos.setDrop}
          />
        </View>
        <Text style={styles.small}>
          El servidor confirma la transacción y corta la respuesta. La app
          consulta el UUID antes de reintentar.
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>Pago simulado</Text>
        {(
          [
            ["approved", "Aprobado"],
            ["declined", "Rechazado"],
            ["uncertain", "Respuesta incierta"],
          ] as [PaymentState, string][]
        ).map(([state, label]) => (
          <Button
            key={state}
            title={`${label}${state === pos.paymentMode ? " · seleccionado" : ""}`}
            onPress={() => pos.setPaymentMode(state)}
            disabled={pos.uncertain}
            secondary
          />
        ))}
        <Text style={styles.small}>
          El resultado incierto se consulta usando la misma referencia. No
          ingresamos datos de tarjetas.
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>Impresora simulada</Text>
        <TextInput
          accessibilityLabel="Fabricante"
          value={pos.manufacturer}
          onChangeText={pos.setManufacturer}
          style={styles.input}
        />
        <Text style={styles.small}>
          Topwise, TOPWISE, Sunmi y Simulator usan adaptadores ficticios. Otro
          fabricante conserva el comprobante digital.
        </Text>
        <View style={styles.row}>
          <Text style={styles.subtitle}>Fallar próxima impresión</Text>
          <Switch
            accessibilityLabel="Fallar próxima impresión"
            value={pos.failPrinter}
            onValueChange={pos.setFailPrinter}
          />
        </View>
      </Card>
    </ScrollView>
  );
}
