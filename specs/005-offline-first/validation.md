# Validación - Spec 005: I4-A Offline-First

## Estado

- **Evidencia técnica histórica:** implementación y pruebas automatizadas ejecutadas el 2026-08-31.
- **Estado de producto:** conexión y sincronización son una funcionalidad futura; esta evidencia no constituye aceptación operativa.
- **Validación manual:** no se realizará bajo este incremento diferido; una spec futura deberá definir y ejecutar su validación.

## Evidencia requerida

| Área | Comando o verificación | Resultado |
|---|---|---|
| Persistencia | `npm run db:test` en `api/` | 27 passed, 0 failed |
| API | `npm test` en `api/` | 58 passed, 0 failed |
| Cliente | `npm test` en `client/` | 48 passed, 0 failed |
| Build | `npm run build` en `client/` | exitoso, 47 módulos transformados |
| Migraciones | `npm run db:migrate -- --status` en `api/` | 001-049 aplicadas, sin pendientes; la 049 corresponde posteriormente a Spec 006 |
| Dependencias | `npm audit` en `api/` y `client/` | 0 vulnerabilidades |
| PWA | navegador sin red y revisión de cache | Pendiente, diferida (Wi-Fi asumido) |
| Operación | 320 px, 768 px y escritorio; teclado y tacto | Pendiente, diferida (Wi-Fi asumido) |

## Matriz de requisitos

| Requisito | Evidencia esperada |
|---|---|
| RF-67, RF-68 | `ballot-store.test.js` cubre cache cifrada aislada y outbox FIFO; `JudgeBallotPage.test.jsx` cubre cola y sincronización. La prueba manual de instalación/desconexión queda pendiente. |
| RF-69, RF-70, RF-71 | `voting-api.test.js` cubre lote, `operationId`, reintento y auditoría única; `ballots.test.js` cubre ledger inmutable. |
| RF-72, RF-73 | `voting-api.test.js` cubre revisión obsoleta y estado canónico; `JudgeBallotPage.test.jsx` cubre conflicto, recarga y descarte explícito. |
| RF-74 | `voting-api.test.js` conserva coberturas de planilla confirmada y revocación. Las verificaciones manuales de sesión/2FA offline quedan pendientes. |
| RF-75 | `ballot-store.test.js`, `session-context.jsx` y `AppNavigation.jsx` implementan aislamiento, cambio de usuario y limpieza en logout; la retención de 12 horas se aplica a cache de lectura. |
| RF-76 | `JudgeBallotPage.test.jsx` cubre estados y acciones de sincronización. Queda pendiente la verificación manual de teclado, tacto y viewports. |

## Límites de validación

- No se considerará validado ningún flujo de `5 por equidad`, subsanación, penalización, escrutinio, resultados o actas.
- La validación debe confirmar que las operaciones offline preservan las invariantes de Spec 004 y que la API sigue siendo autoritativa.
