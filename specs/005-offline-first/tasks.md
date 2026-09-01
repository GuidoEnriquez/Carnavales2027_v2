# Tasks - Spec 005: I4-A Offline-First

## Estado general

| ID | Estado | Dependencias |
|---|---|---|
| T01-T06 | Código exploratorio y evidencia técnica existentes | No implican aceptación operativa de conexión/sincronización. |
| T07 | Diferida a funcionalidad futura | Cualquier activación, modificación o retiro requiere una spec posterior aprobada. |

## T01 - Protocolo y migraciones de sincronización

**RF:** RF-70, RF-71, RF-72.

- Crear migraciones incrementales para revisión de planilla y ledger idempotente de operaciones.
- Proteger unicidad por actor, planilla y `operationId`; guardar hash de contenido y resultado sin puntajes.
- Cubrir migración repetible, deduplicación, conflicto y no duplicación de auditoría.

## T02 - Servicio y contrato de sincronización

**RF:** RF-69 a RF-74.

- Implementar procesamiento transaccional FIFO por planilla reutilizando las validaciones autoritativas de voto.
- Devolver contratos de conflicto, rechazo terminal y resultado idempotente estables.
- Impedir operaciones administrativas, subsanaciones, penalizaciones y escrutinio.

## T03 - Almacenamiento local seguro

**RF:** RF-67, RF-68, RF-75.

- Incorporar manifest, service worker de recursos estáticos y repositorio IndexedDB cifrado por usuario.
- Persistir planillas descargadas y outbox antes de mutar la interfaz; borrar datos por logout, cambio de usuario y retención.
- No usar cache HTTP de API ni almacenar datos de otro usuario.

## T04 - Integración de planilla del jurado

**RF:** RF-67 a RF-76.

- Adaptar la planilla para lectura offline, mutación optimista respaldada por outbox y sincronización en primer plano.
- Mostrar conectividad, pendientes, sincronización, conflicto, reintento y descarte explícitos.
- Mantener las garantías de accesibilidad, foco, teclado, tacto y responsive de Spec 004.

## T05 - Conflicto y seguridad operativa

**RF:** RF-72 a RF-76, RNF-01, RNF-02.

- Detener la outbox ante conflicto o rechazo terminal y ofrecer recarga/descartar sin sobrescritura automática.
- Confirmar que ningún rol distinto de JUDGE accede al contenido local de una planilla propia.
- Revisar exposición de puntajes, logs, auditoría y eliminación de claves locales.

## T06 - Pruebas automatizadas

**RF:** RF-67 a RF-76, RNF-04.

- Agregar pruebas DB/API de idempotencia, reintentos, conflicto, cierre, revocación, sesión/2FA y auditoría única.
- Agregar pruebas de cliente para IndexedDB, falta/retorno de red, limpieza de sesión, conflicto y controles accesibles.
- Probar que service worker no cachea API ni datos autenticados.

## T07 - Validación final

**Dependencias:** T01-T06.

- Ejecutar suites DB, API y cliente; build, chequeo de migraciones y revisión de seguridad local.
- Verificar 320 px, 768 px y escritorio con teclado y una outbox extensa.
- Actualizar validación, estado SDD, mapa de fuentes y README solo con evidencia comprobada.
