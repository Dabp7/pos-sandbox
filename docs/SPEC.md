# SPEC: venta offline y entrega idempotente

Objetivo: confirmar un carrito ficticio una sola vez, persistirlo antes de anunciar éxito y entregar el comprobante a PostgreSQL aunque se pierda una respuesta.

Alcance: catálogo sintético GTQ, descuentos por línea antes de impuesto demo, SQLite transaccional, historial, snapshot imprimible, adaptadores ficticios de pago e impresión, outbox con lease/fencing/backoff, API validada y escenarios repetibles.

Casos de error: moneda/cantidad inválida, total manipulado, UUID reutilizado con otro payload, respuesta perdida después de commit, cierre en mitad de sincronización, impresora sin papel/fabricante sin adaptador, pago incierto. La app conserva información y presenta el siguiente paso.

Criterios: duplicados concurrentes producen una venta; descuento se aplica una vez; un fallo entre venta y outbox hace rollback; el archivo SQLite sobrevive reapertura; worker vencido no confirma el nuevo lease; impresión fallida no duplica; PostgreSQL rechaza payload distinto con 409; respuesta cortada tras commit se resuelve consultando UUID. La evidencia nativa se separa de tests de Node y web.

Fuera de alcance: hardware real, cobros, tarjetas, certificación fiscal, servicios cloud, tiendas de apps o sincronización garantizada con el proceso terminado.
