# Arquitectura

La app Expo Router conserva productos ficticios, ventas, líneas y outbox en SQLite. `SaleStore.save` es el límite transaccional: el comprobante y la intención se guardan juntos. Una cola por conexión impide que consultas ajenas entren en una transacción asíncrona. Las claves primarias evitan duplicar confirmaciones.

El sincronizador reclama una intención con lease y fencing token. Solo su propietario vigente puede confirmar el resultado; leases vencidos se recuperan después de reabrir. Los reintentos usan backoff acotado y un máximo de ocho intentos; desde el historial se puede volver a intentar manualmente.

Express valida el contrato y recalcula importes. PostgreSQL conserva el hash SHA-256 canónico junto a la venta. La clave única `(actor_id,id)` resuelve la carrera entre peticiones concurrentes. Mismo UUID y payload devuelve el recurso existente; otro payload devuelve 409. El proveedor de pago y la impresora son adaptadores ficticios locales.

El actor configurado en servidor delimita datos de demo, sin representar autenticación empresarial. SQLite es la fuente local del comprobante; PostgreSQL es la confirmación de recepción. La app nunca interpreta falta de conectividad como una garantía sobre lo ocurrido en el servidor.
