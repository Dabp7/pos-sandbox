# Guion reproducible

Iniciar PostgreSQL, migrar e iniciar API y Expo con el README. Abrir la app en Android o web con los headers COOP/COEP de Metro.

Crear venta con dos cafés y descuento 10%: subtotal Q57.00, descuento Q5.70, impuesto demo Q6.16, total Q57.46. Usar modo sin red, confirmar y cerrar completamente la app. Al volver, mostrar ese UUID en Historial.

En Simuladores forzar fallo de impresora y reimprimir. Mostrar que no aparece otra venta y que el comprobante conserva líneas e importes. Reimprimir una segunda vez y mostrar COPIA.

Activar pérdida de respuesta tras guardar y restaurar conexión. Sincronizar; mostrar estado confirmado. Consultar `GET /api/sales/:id` y contar un solo UUID. Cambiar payload con la misma clave produce 409.

Para pago incierto seleccionar ese escenario antes de confirmar un carrito nuevo. Mostrar la consulta del mismo intento y la misma referencia simulada. No ingresar tarjetas ni dinero.

Registrar plataforma, SDK, comandos, commit y resultados. Una prueba SQLite de Node o web no se etiqueta como evidencia Android. No hay prueba de impresora física ni cobros.
