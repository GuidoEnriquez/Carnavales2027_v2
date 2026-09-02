# Tasks — Spec 011 Sorteo ceremonial

> Cada tarea implementa una unidad acotada y se detiene tras su validación. No anticipar tareas posteriores.

## T01 — Servicio de sorteo ceremonial (backend, sin HTTP)

**Alcance:** crear `api/src/modules/results/ceremonial-draw-service.js` con funciones puras.

- `buildSeed()` → nonce hexadecimal generado con `crypto.randomBytes(16)` para trazabilidad del sorteo.
- `selectCeremonialWinner({ pool, seed })`:
  - Si `pool.length === 0` → `throw { code: 'TIE_BREAKER_EMPTY_DRAW_POOL' }`.
  - Si `pool.length === 1` → retorna `{ winnerTroupeId: pool[0], seed, randomValue: 0, method: 'POOL_SINGLETON' }`.
- Caso normal → `crypto.randomInt(pool.length)` con nonce documentado, `method: 'CRYPTO_RANDOM_INT'`.
- `composeAuditEvent({ eventId, tiedTroupeIds, appliedCriteria, seed, randomValue, winnerTroupeId, actor, occurredAt, correlationId })` → payload listo para `audit_event` (sin tocar la BD).

**RF cubierto:** RF-99 (validación de pool), RF-101 (selección aleatoria seedeada), RF-102 (estructura del evento de auditoría).

**Estado (2026-09-02):** ✅ COMPLETADO y actualizado al contrato aprobado.

**Hecho cuando:**
- ✅ Archivo creado: `api/src/modules/results/ceremonial-draw-service.js`.
- ✅ Test unitario `ceremonial-draw-service.test.js` cubre: pool vacío, pool singleton, pool de 3 elementos con seed fijo debe devolver siempre el mismo índice, dos seeds distintos pueden producir distintos índices (verificación probabilística, no determinística, con tolerancia).
- ✅ 18/18 tests del servicio pasan.
- ✅ Suite API completa: 89/89 passed (incluye 18 nuevos del servicio ceremonial).
- ✅ Suite cliente: 53/53 passed (sin cambios).

**Notas de implementación:**
- El nonce no alimenta la selección ni afirma reproducibilidad; `randomIntFn` permite inyectar un índice en tests.
- `composeAuditEvent` permite `tiedTroupeIds.length === 1` solo cuando `method === 'POOL_SINGLETON'` (caso degenerado). En la ruta HTTP de T02 esto se valida antes para no persistir auditoría sin empate real.

## T02 — Endpoint HTTP y autorización

**Alcance:** agregar ruta en `api/src/routes/results.routes.js`.

- `POST /api/v1/events/{eventId}/tie-breaker/ceremonial-draw`:
  - Valida `eventId` y body `{ remainingTroupeIds: string[] }`.
  - Verifica 2FA y rol `ADMIN`, `SCRUTINEER` o `ESCRIBANO`.
  - Verifica `results_release` para el evento (RF-94 + Spec 010).
  - Verifica que el empate siga vigente llamando a `determineBestTroupe` con los mismos rankings (mitiga `TIE_BREAKER_STALE`).
  - Verifica que `remainingTroupeIds` coincida exactamente con el pool vigente (RF-99).
  - Verifica que no exista ya un `RESULTS_TIE_BREAKER_CEREMONIAL_DRAW` para ese empate (RF-104, `TIE_BREAKER_ALREADY_DRAWN`).
  - Deriva criterios y pool final del servidor, llama a T01 y persiste una auditoría SHA-256 encadenada.
- Errores: 403 (rol/2FA), 409 (`RESULTS_NOT_RELEASED`, `TIE_BREAKER_NOT_REQUIRED`, `TIE_BREAKER_ALREADY_DRAWN`, `TIE_BREAKER_STALE`), 422 (`TIE_BREAKER_EMPTY_DRAW_POOL`, `TIE_BREAKER_INVALID_DRAW_INPUT`).

**RF cubierto:** RF-98 (endpoint), RF-103 (autorización), RF-104 (idempotencia).

**Hecho cuando:**
- Ruta agregada y registrada en el router.
- Tests de integración `results-ceremonial-draw.test.js` cubren: éxito, rol no autorizado (403), resultado no liberado (409), `troupeId` inválido (422), doble sorteo (409), pool vacío (422).
- Suite API completa pasa.

**Estado (2026-09-02):** ✅ COMPLETADO y actualizado al contrato aprobado.

**Evidencia:** test de integración `api/src/tests/results-ceremonial-draw.test.js` pasa (1/1); suite API completa pasa (90/90); suite DB pasa (37/37). Migraciones 054 y 055 aplicadas en la base de test.

## T03 — Hook de countdown reutilizable (cliente)

**Alcance:** crear `client/src/features/results/useCountdown.js`.

- `useCountdown(seconds, { onComplete })`:
  - Devuelve `{ value, isRunning, start(), cancel() }`.
  - `start()` arranca el conteo en `seconds` y decrementa cada 1000 ms.
  - Al llegar a 0 invoca `onComplete` y marca `isRunning = false`.
  - Cleanup en `useEffect` para evitar memory leaks.

**RF cubierto:** RF-100 (countdown visible).

**Hecho cuando:**
- ✅ Hook creado: `client/src/features/results/useCountdown.js`.
- ✅ Test `useCountdown.test.jsx` cubre: arranca en `seconds`, decrementa cada 1000 ms (con fake timers), invoca `onComplete` al llegar a 0, se cancela correctamente.
- ✅ Test específico: 4/4 passed.
- ✅ Suite cliente: 19 archivos, 57/57 passed.
- ✅ Build cliente exitoso; 48 módulos transformados.

**Estado (2026-09-01):** ✅ COMPLETADO.

## T04 — Modal de sorteo ceremonial (cliente)

**Alcance:** crear `client/src/features/results/CeremonialDrawModal.jsx` y `useCeremonialDraw.js`.

- `<CeremonialDrawModal>` recibe `{ eventId, remainingTroupeIds, appliedCriteria, tiedTroupeNames, onClose, onResolved }`.
- Estados internos: `IDLE` → `COUNTDOWN` → `REVEALING` → `DONE`.
- `IDLE`: muestra las comparsas empatadas, botón "Iniciar sorteo ceremonial".
- `COUNTDOWN`: muestra el número grande del countdown (5→0), botón "Cancelar".
- `REVEALING`: al llegar a 0, dispara `POST` vía `useCeremonialDraw` y muestra estado "Revelando…".
- `DONE`: muestra la comparsa ganadora con un destaque visual (badge grande), botón "Cerrar".
- Foco: al abrir, foco en el botón "Iniciar"; al cerrar (Escape o botón), foco devuelto al disparador.
- Atajos: `Escape` cancela/cerrar según estado, `Enter` activa el botón primario.
- Respeta tokens visuales del rediseño Spec 009 (dark, surface elevada, border radius 0.9rem, font Inter).

**RF cubierto:** RF-100, RF-105 (UX accesible), RF-103 (UI restringida a roles autorizados).

**Hecho cuando:**
- ✅ Componente creado: `client/src/features/results/CeremonialDrawModal.jsx`.
- ✅ Hook creado: `client/src/features/results/useCeremonialDraw.js`.
- ✅ Tests `CeremonialDrawModal.test.jsx` cubren: render inicial, transición a countdown al iniciar, render del ganador al resolver, cancelación, cierre con Escape y devolución de foco.
- ✅ Test específico: 4/4 passed.
- ✅ Suite cliente: 21 archivos, 63/63 passed.
- ✅ Build del cliente exitoso; 48 módulos transformados.

**Estado (2026-09-01):** ✅ IMPLEMENTADO Y VALIDADO AUTOMÁTICAMENTE.

**Integración:** la vista `#/admin/results` se incorporó durante T04 para montar el modal y consumir el resultado liberado. La pantalla detecta el empate persistente, muestra las comparsas y ofrece el sorteo ceremonial exclusivamente a `SCRUTINEER` (visible como Escrutador / Escribano); `ADMIN` no visualiza el acceso.

**Corrección UX posterior:** si falla `GET /api/v1/events`, la pantalla deja de mostrar el loading infinito y presenta un mensaje accionable sobre API/sesión.

## T05 — Estilos CSS del modal

**Alcance:** extender `client/src/index.css` con los estilos de `.ceremonial-draw-modal`, `.ceremonial-draw-overlay`, `.countdown-display`, `.winner-reveal` y estados asociados. Reutilizar tokens del rediseño Spec 009 (variables `--surface`, `--line-color`, `--primary-color`, `--success-color`, `--accent-color`, `--font`).

**RF cubierto:** RF-100, RF-105.

**Hecho cuando:**
- ✅ Reglas agregadas al final del bloque "Spec 009" sin colisionar con selectores existentes.
- ✅ Suite cliente: 21 archivos, 63/63 passed.
- ✅ Build cliente exitoso.
- Pendiente: inspección visual manual en los 3 viewports (responsabilidad del responsable; ver T06).

**Estado (2026-09-01):** ✅ IMPLEMENTADO Y VALIDADO AUTOMÁTICAMENTE.

## T06 — Validación manual de UX

**Alcance:** recorrido manual por el responsable en Chrome con emulación responsive.

- 390x844 (iPhone), 768x1024 (iPad portrait), 1440x900 (desktop).
- Teclado: foco inicial visible, Tab recorre, Enter activa, Escape cancela y devuelve foco.
- Emulación táctil: tap activa el botón "Iniciar sorteo" sin hover.
- Contraste WCAG AA en los textos del modal y el countdown.
- Animación del countdown no depende de hover ni de eventos del mouse.

**RF cubierto:** RF-105.

**Estado (2026-09-01):** ⏳ PENDIENTE DE VALIDACIÓN MANUAL.

**Integración realizada:** `client/src/App.jsx` expone `#/admin/results`; `AdminResultsPage.jsx` carga eventos, comparsas y resultados liberados, detecta `TIE_BREAKER_REQUIRES_MANUAL_DRAW` y monta `CeremonialDrawModal`. La comprobación manual end-to-end ya es posible.

**Hecho cuando:**
- Resultado registrado en `validation.md` §Comprobación manual por el responsable.
- Sin hallazgos bloqueantes, o hallazgos resueltos en T05.

## T07 — Cierre de Spec 011

**Alcance:** actualizar `validation.md` con la evidencia completa.

- Estado: implementación y validación completadas.
- Tabla de evidencia ejecutada (APIs, cliente, build).
- Matriz RF-98 a RF-105 con la prueba o archivo que demuestra el cumplimiento.
- Comprobación manual registrada.
- Actualizar `docs/sdd-status.md` para mover Spec 011 a completados (si todo cierra) o dejarla vigente con la nota de lo pendiente.

**Hecho cuando:** `validation.md` aceptada por el responsable.

---

**Notas operativas:**
- Las tareas T01–T05 se ejecutan en orden estricto.
- T06 bloquea T07: la validación manual es requisito de cierre.
- Cualquier corrección post-cierre se gestiona como una nueva spec (`012-...` o hotfix explícito).
