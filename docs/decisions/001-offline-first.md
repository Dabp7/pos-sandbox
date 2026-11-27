# Decisiones de la primera versión

- Expo SDK 58 se verificó con el template oficial y `expo install`. El template recién publicado usaba Expo58.1.0/core58.2 y falló al iniciar en ExpoGo58.0.6 con `EventEmitter undefined`. Se fijó Expo58.0.26/core58.1 y sus peers nativos compatibles; la prueba real Android pasó después. `expo.install.exclude` excluye únicamente la actualización automática de `expo` para conservar ese patch comprobado. Navegación con Expo Router conforme al starter.
- SQLite y outbox transaccional en vez de almacenamiento de objetos sueltos: permite conservar comprobante e intención de entrega juntos.
- `withTransactionAsync` y una cola única para todo acceso a la conexión. `withExclusiveTransactionAsync` abre otra conexión sin heredar `foreign_keys`; la cola permite mantener las restricciones y compartir el adaptador web.
- BigInt para multiplicaciones y división half-up, con límites enteros seguros al convertir resultados. No se usan floats para calcular porcentajes.
- Vitest verifica dominio, adaptadores, SQLite real y contratos HTTP; las pruebas de navegador cubren la UI cuando se ejecutan. Se evita un segundo runner Jest duplicado. Esta elección no sustituye validación Android de SQLite nativo.
- Sin background task nativa: primer plano, retorno a la app y botón manual. La intención permanece en disco cuando el proceso termina.
- Sin servicios AWS ni pagos reales. SDK de fabricante, builds firmados y publicación en tiendas quedan fuera del MVP.
- Override de minimatch11.0.9 en fingerprint y pins de tooling para corregir los avisos de seguridad del árbol instalado; conservar el lock y volver a validar compatibilidad antes de actualizar Expo.
- Expo 58.0.26 y core 58.1.0 también se fijan mediante overrides del workspace para impedir una segunda copia nativa incompatible en dependencias anidadas. El lock fue regenerado y se verificó con `npm ci`.
