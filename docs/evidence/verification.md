# Evidencia de verificación

Fecha final: 2026-11-27. Windows, Node.js 22.15.0 y npm 10.9.2.

- `npm ci --no-audit --no-fund`: instalación limpia aprobada desde el lock final; 872 paquetes.
- `TEST_DATABASE_URL=postgresql://demo:demo@127.0.0.1:55432/possandbox npm run verify`: typecheck, lint, 13 pruebas y build web aprobados. PostgreSQL 17.12 real y SQLite real de Node, sin mocks de persistencia.
- Pruebas: descuentos/redondeo, entradas inválidas, referencia de pago estable y colisión de importe, normalización de fabricante, impresión, doble confirmación, rollback entre venta/outbox, reapertura de archivo SQLite, leases/fencing y último intento interrumpido. API: diez POST simultáneos, 409 por otro payload, validación, actor aislado y socket cortado después de commit.
- `npm audit --audit-level=low`: cero vulnerabilidades.
- `npx expo install --check` desde `apps/mobile`: compatible; se excluye deliberadamente actualizar el patch de `expo`.
- `POS_RECORD_VIDEO=1 npm run test:web`: aprobado en Chromium a 390 px. Venta offline, SQLite WASM sobrevive recarga, total 5746 centavos, fallo de impresora/copia, sincronización con respuesta perdida, cero errores JS y sin overflow horizontal.
- Capturas reales de la UI web: `pos-home.png` y `pos-mobile.png`. Video real del recorrido web: `pos-demo-web.webm` (la plataforma del video es web, no Android).
- Android API 36 x86_64, Expo Go 58.0.6, Expo 58.0.26/core 58.1.0: prueba nativa aprobada. `save` persiste; `am force-stop` mata el proceso; con WiFi/datos apagados `read` conserva venta y total, falla impresión sin duplicar y genera COPIA. Al restaurar red, `sync` resuelve respuesta perdida tras commit. PostgreSQL conserva exactamente una fila para el UUID. Resultados en `native-results.json`.
- Expo 58.1.0/core 58.2 del template recién publicado falló al iniciar módulos en Expo Go. El patch comprobado y los peers nativos quedaron fijados. Se regeneró el lock para eliminar una versión anidada antigua; la inspección final contiene únicamente Expo 58.0.26 y core 58.1.0.
- AVD, Metro, servidor API y preview de esta verificación se detienen al finalizar. No se modificaron ajustes globales del host para la prueba.

Sin hardware de impresión, cobros, credenciales productivas ni recursos AWS. La prueba Android verifica SQLite dentro del runtime nativo; no certifica integración con un dispositivo POS físico ni publicación en tiendas.
