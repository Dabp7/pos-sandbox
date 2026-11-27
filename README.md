# POS Sandbox

Una venta móvil debe sobrevivir al cierre de la app y a una respuesta perdida del servidor. Esta demo conserva un comprobante inmutable en SQLite y sincroniza con una API PostgreSQL usando el UUID de la venta como clave idempotente.

**Todos los productos, pagos e impresoras son simulados. No acepta tarjetas, no hace cobros y no emite documentos fiscales. AWS queda aplazado.**

## Requisitos

- Node.js 22.13 o superior compatible con Expo SDK 58 (se verificó con Node 22.15).
- npm y PostgreSQL 17+; opcionalmente Docker Compose para la base.
- Expo Go compatible con SDK 58 o development build en Android. La vista web complementa la demo; no demuestra hardware físico.

## Instalación reproducible

```sh
npm ci
docker compose up -d db
npm run db:migrate
npm run api
```

La API escucha en `http://localhost:4310`. En otra terminal:

```sh
npm start
# o npm run android
# o npm run web
```

Si ya tiene PostgreSQL, cree una base vacía `possandbox` y configure `DATABASE_URL`. Los valores de `.env.example` son ficticios para un entorno local. La API usa por defecto `postgres://demo:demo@localhost:55432/possandbox`.

En emulador Android la API del equipo se encuentra en `http://10.0.2.2:4310`; en un dispositivo físico configure la IP LAN del equipo en Simuladores o en `apps/mobile/.env` como `EXPO_PUBLIC_API_BASE_URL=http://IP_DEL_EQUIPO:4310`. El teléfono y el equipo deben compartir red. Ninguna variable `EXPO_PUBLIC_*` contiene secretos.

## Recorrido

1. Abra Simuladores y active «Simular modo sin red» (para una prueba de red real use modo avión).
2. En Venta agregue productos, seleccione descuento y confirme. El resultado confirma guardado local solo después del commit SQLite.
3. Cierre completamente la app y vuelva a abrirla. Historial conserva la venta y el estado pendiente.
4. Active «Fallar próxima impresión» y reimprima desde el comprobante. Un fallo no altera el total, la venta ni el pago; la próxima reimpresión dice COPIA.
5. Active «Perder respuesta tras guardar», restaure conexión y sincronice. La API guarda antes de cortar el socket; la app consulta el UUID y confirma una sola venta.
6. Seleccione pago incierto: no crea una segunda autorización. «Consultar pago y guardar» conserva la referencia.

El impuesto de 12% es una regla **de demostración**, no asesoría tributaria. Precios e importes son enteros en centavos GTQ; descuento antes del impuesto y redondeo half-up por línea con aritmética BigInt. El comprobante se serializa desde el snapshot calculado, sin volver a aplicar el descuento.

## Verificación

```sh
npm run typecheck
npm test
npm run build:web
npm run web:preview
# Con la API y web:preview activos, en otra terminal:
npx playwright install chromium
npm run test:web
npm --prefix apps/api run verify
cd apps/mobile
npx expo install --check
npm run lint
```

Las pruebas de PostgreSQL requieren `TEST_DATABASE_URL` y se omiten explícitamente si no está definido. Use una base exclusiva de pruebas:

```powershell
$env:TEST_DATABASE_URL='postgres://demo:demo@localhost:55432/possandbox'
npm run test:integration
```

CI define esa variable y prueba contra un servicio PostgreSQL real. Las pruebas de persistencia usan SQLite real de Node; no equivalen a ejecutar SQLite nativo dentro de Android. La evidencia y las comprobaciones pendientes están en `docs/evidence/verification.md`.

## API

- `GET /health`: comprueba PostgreSQL y declara modo demo.
- `GET /api/catalog`: catálogo sintético versionado.
- `POST /api/sales`: `Idempotency-Key` igual al UUID del cuerpo; crea con 201, repite con 200, colisión con 409. Valida estructura, moneda e importes recalculados.
- `GET /api/sales/:id`: comprobante del actor de demo configurado; 404 para otro actor.
- `GET /api/sales`: últimas 100 ventas del actor de demo.

Los errores exponen `code`, `message` y `correlationId`. El header `X-Demo-Drop-Response: once` corta únicamente la respuesta del primer INSERT después de su commit; existe solo para reproducir el escenario de incertidumbre.

No hay autenticación productiva: `DEMO_ACTOR_ID` es una partición local fija, no una credencial. Mantenga esta API en un entorno de demostración con datos sintéticos. No conecte dinero, certificados, credenciales o sistemas de una empresa.

## Arquitectura y límites

`Expo Router → casos de uso → dominio → SQLite (sales + lines + outbox) → sincronizador → Express → PostgreSQL`

La persistencia usa una cola de acceso por conexión y transacciones; los trabajos tienen lease, token monotónico y reintentos acotados. La confirmación de un worker vencido no elimina la intención de un worker nuevo. Al agotar intentos el historial permite recuperación manual. Los adaptadores normalizan fabricante y declaran capabilities.

La demo funciona en primer plano y al volver a la app; no promete sincronización cuando el sistema operativo termina el proceso. El historial muestra las últimas 100 ventas. La web usa SQLite WASM y requiere aislamiento de origen; Metro y `npm run web:preview` ya configuran COOP/COEP. Un host estático necesita esos mismos headers. No hay integración con hardware real ni evidencia de una impresora física.

Expo está fijado en58.0.26: se comprobó en ExpoGo58.0.6 sobre AndroidAPI36. El template58.1.0 recién publicado produjo un error de inicialización de módulos nativos; la decisión y el cambio están documentados. La evidencia `docs/evidence/native-results.json` registra guardado, cierre forzado/reapertura offline, fallo de impresora/copia y sincronización tras pérdida de respuesta.

Ver [arquitectura](docs/architecture.md), [decisiones](docs/decisions/001-offline-first.md) y [guion](docs/demo.md).
