# POS Sandbox

Comandos reales: `npm ci`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build:web`, `npm run api`, `npm start`. Las pruebas de integración necesitan `TEST_DATABASE_URL`; no afirmar que se ejecutaron si se omiten.

No procesar pagos reales ni incluir datos privados. AWS aplazado. Importes enteros, GTQ, descuento una vez antes del impuesto, snapshot inmutable. Venta y outbox se guardan en una transacción. Respuesta perdida significa incertidumbre; consultar el UUID estable. Fallo de impresora no revierte venta. Mantener explícitos los límites de Expo Go, pruebas JS y hardware físico.
