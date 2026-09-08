# Validación — Spec 025: Votación Secuencial por Orden de Pasada

## Estrategia de Validación y Evidencia

### Criterios de Aceptación:
1. **Comportamiento Secuencial Inicial:**
   - Al abrirse una noche con 3 comparsas (Orden 1: Ara Yevi, Orden 2: Mari Mari, Orden 3: Kamarr), solo la comparsa 1 tiene botón "Comenzar" habilitado.
   - Las comparsas 2 y 3 se muestran visualmente con candado 🔒, pill "En espera" y botón deshabilitado.
2. **Transición al Completar Comparsa 1:**
   - Cuando el jurado puntúa el 100% de los ítems de Ara Yevi, la tarjeta de Ara Yevi pasa a "Cerrada / Ver planilla", y Mari Mari pasa de "En espera" a "Comenzar" habilitado.
   - Kamarr permanece bloqueada hasta que Mari Mari alcance el 100%.
3. **Guardia contra Acceso Forzado por URL:**
   - Si el jurado escribe en el navegador la URL de Kamarr directamente estando Ara Yevi incompleta, la interfaz no renderiza la grilla de Kamarr; muestra el resguardo de turno y botón para regresar a Ara Yevi.
4. **Validación en Backend:**
   - Un request directo de API a la comparsa 3 estando la comparsa 1 con pendientes retorna `409 Conflict` con código `TROUPE_PRECEDENCE_REQUIRED`.
5. **Calidad de Código y Build:**
   - 100% de tests pasando en verde.
   - Compilación limpia en Vite.
   - `git diff --check` sin errores.

## Evidencia Fase 1: Secuencialidad en Home del Jurado (2026-09-08)

**Resultado:** Lógica secuencial implementada y validada en `JudgeHomePage.jsx`. Requisitos cubiertos: Spec-025 / RF-189 y RF-190.

1. **Cálculo Secuencial:** Se implementó `isTroupeLockedInSequence(troupeIndex, troupesList)`, la cual garantiza que una comparsa solo esté habilitada si todas las comparsas precedentes de la misma noche están confirmadas (`SUBMITTED`) o tienen `resolved >= total`.
2. **Estado Visual y Accesibilidad:**
   - Comparsas bloqueadas se marcan con la clase `.is-locked` y badge `<StatusPill status="LOCKED" label="En espera" />`.
   - El botón de navegación se reemplaza por `<button type="button" className="button-link is-disabled" disabled aria-disabled="true">` informando *"🔒 En espera de pasada"*.
   - Texto informativo accesible: *"Se habilitará al completar la comparsa anterior"*.
3. **Pruebas Automatizadas:** 2 tests dedicados en `JudgeHomePage.test.jsx` validando el bloqueo de comparsas posteriores y el desbloqueo secuencial inmediato al completar la comparsa precedente.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run src/tests/JudgeHomePage.test.jsx` | 7/7 aprobados en 1 archivo (incluyendo 2 pruebas de secuencia y bloqueo) |
| `npm test` en `client/` | 243/243 aprobados en 40 archivos; 7.07 s |
| `npm run build` en `client/` | Exitoso en 933 ms (68 módulos; CSS 97.62 kB, JS 373.11 kB) |
| `git diff --check` | 0 advertencias / 0 errores |

---

## Evidencia Fase 2: Guardia de Navegación y Continuidad en Planilla (2026-09-08)

**Resultado:** Guardia URL y flujo de continuidad implementados y validados en `JudgeBallotPage.jsx`. Requisitos cubiertos: Spec-025 / RF-191 y RF-192.

1. **Guardia contra Acceso Forzado por URL (RF-191):**
   - Cuando el jurado intenta navegar directamente a una comparsa bloqueada (`presentationOrder > activeGroup.presentationOrder`), `JudgeBallotPage.jsx` intercepta la carga y sustituye la grilla por la pantalla de resguardo `.judge-ballot-guard`.
   - Se muestra título *"Comparsa en espera de pasada"*, descripción indicando calificar primero a la comparsa activa, y botón de navegación directa *"Ir a comparsa actual →"* junto al enlace de retorno a las comparsas.
2. **Banner de Continuidad de Pasada (RF-192):**
   - Al registrar el último ítem pendiente de una comparsa en pista, la planilla despliega de inmediato el banner accesible `.troupe-continuity-banner` (*"¡Completaste la evaluación de [Comparsa]! Siguiente comparsa en pista: [Siguiente Comparsa]"*).
   - Ofrece el botón de acción principal *"Comenzar siguiente pasada ([Siguiente Comparsa]) →"* que desbloquea, navega y posiciona el cursor en el primer criterio de la comparsa entrante.
3. **Resguardo en Barra Lateral y Modo Lista:**
   - La barra lateral marca las comparsas en espera con icono 🔒 y desactiva su botón interactivo (`disabled`, `aria-disabled="true"`).
   - El modo lista renderiza tarjetas informativas de bloqueo (`.troupe-locked-card`) en lugar de botones interactivos de puntuación para comparsas no habilitadas.
4. **Pruebas Automatizadas:** 3 nuevos tests en `JudgeBallotPage.test.jsx` cubriendo guardia de URL directa, continuidad y renderizado bloqueado.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run src/tests/JudgeBallotPage.test.jsx` | 7/7 aprobados en 1 archivo (incluyendo 3 pruebas de guardia y continuidad) |
| `npm test` en `client/` | 246/246 aprobados en 40 archivos; 7.39 s |
| `npm run build` en `client/` | Exitoso en 946 ms (68 módulos; CSS 99.94 kB, JS 377.21 kB) |
| `git diff --check` | 0 advertencias / 0 errores |

---

## Evidencia Fase 3: Guardia de Integridad en Backend (2026-09-08)

**Resultado:** Defensa e integridad en backend implementadas y validadas en `ballot-service.js` y `http-errors.js`. Requisitos cubiertos: Spec-025 / RF-193.

1. **Defensa Transaccional en Base de Datos ([ballot-service.js](file:///home/guido/dev/Proyectos/Carnavales2027_v2/api/src/modules/ballots/ballot-service.js)):**
   - En `saveScoreLocked` (invocado tanto por PUT `/api/v1/judge/ballots/:ballotId/scores/:scoreId` como por POST `/api/v1/judge/ballots/:ballotId/sync`), se consulta el `presentation_order` del `night_troupe_schedule` de la comparsa correspondiente al puntaje.
   - Si existen registros con `evaluation_state = 'PENDING'` en comparsas con `presentation_order` estrictamente menor dentro de la misma planilla, se aborta la transacción y se arroja error `TROUPE_PRECEDENCE_REQUIRED`.
2. **Mapeo de Error HTTP 409 Conflict ([http-errors.js](file:///home/guido/dev/Proyectos/Carnavales2027_v2/api/src/routes/http-errors.js)):**
   - La capa de ruteo captura `TROUPE_PRECEDENCE_REQUIRED` y responde formalmente `HTTP 409 Conflict` con cuerpo JSON `{ "code": "TROUPE_PRECEDENCE_REQUIRED" }`.
3. **Pruebas Automatizadas:**
   - Nueva suite dedicada: [`src/tests/ballot-sequence-precedence.test.js`](file:///home/guido/dev/Proyectos/Carnavales2027_v2/api/src/tests/ballot-sequence-precedence.test.js) con 13 pasos de verificación secuencial: bloqueo de comparsa 2 por comparsa 1, rechazo en servicio directo, desbloqueo vía `SCORED` y `NOT_PRESENTED`, bloqueo de comparsa 3 por comparsa 2, y confirmación final de planilla.
   - Actualizada [`src/tests/judge-ballots-progress.test.js`](file:///home/guido/dev/Proyectos/Carnavales2027_v2/api/src/tests/judge-ballots-progress.test.js) con validación cruzada de `TROUPE_PRECEDENCE_REQUIRED` en desfile real.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `node --test src/tests/ballot-sequence-precedence.test.js` en `api/` | 1/1 aprobados (269 ms; flujo completo de 3 comparsas) |
| `node --test src/tests/judge-ballots-progress.test.js` en `api/` | 1/1 aprobados (238 ms; verificación cruzada) |
| `npm test` en `api/` | 142/142 aprobados en 5 suites (27.80 s) |
| `npm test` en `client/` | 246/246 aprobados en 40 suites (6.95 s) |
| `npm run build` en `client/` | Exitoso en 886 ms |
| `git diff --check` | 0 advertencias / 0 errores |

---

## Evidencia Fase 4: Control Centralizado por Mesa de Control / Admin (2026-09-08)

**Resultado:** Control de pista y pasada en vivo implementado y validado en `ballot-service.js` y `AdminVotingPage.jsx`. Requisitos cubiertos: Spec-025 / RF-194.

1. **Enriquecimiento del Estado de Votación ([ballot-service.js](file:///home/guido/dev/Proyectos/Carnavales2027_v2/api/src/modules/ballots/ballot-service.js)):**
   - `getVotingStatus({ eventId, nightId })` consulta el cronograma oficial de la noche (`night_troupe_schedule`), agregando para cada comparsa: `scheduleId`, `presentationOrder`, `troupeName`, `brandColor`, `totalScores` y `resolvedScores`.
   - Deriva automáticamente el estado de cada comparsa (`COMPLETED`, `IN_RUNWAY`, `WAITING`) y expone `activeTroupe` con la comparsa actualmente desfilando en pista.
2. **Panel de Mesa de Control en Vivo ([AdminVotingPage.jsx](file:///home/guido/dev/Proyectos/Carnavales2027_v2/client/src/pages/AdminVotingPage.jsx)):**
   - Incorpora la sección `.runway-control-section` ("Control de pista y orden de pasada").
   - Tarjeta destacada de "Comparsa en pista": Salida #, nombre oficial con color institucional, badge `EN PISTA`, contador de votos de jurados resueltos (`resolvedScores / totalScores`) y barra de progreso.
   - Cronograma secuencial de pasadas: grilla interactiva con cada comparsa, badges semánticos (`COMPLETADA`, `EN PISTA`, `EN ESPERA`), porcentaje y mini barra de avance.
   - Botón de actualización inmediata *"Actualizar pista"* para refrescar el estado del desfile en vivo sin recargar la página.
3. **Estilos y Tokens ([components.css](file:///home/guido/dev/Proyectos/Carnavales2027_v2/client/src/styles/components.css)):**
   - Clases dedicadas respetando la capa de instrumento y tokens de espaciado, bordes y tipografía.
4. **Pruebas Automatizadas:**
   - [`AdminVotingPage.test.jsx`](file:///home/guido/dev/Proyectos/Carnavales2027_v2/client/src/tests/AdminVotingPage.test.jsx): nuevo test de integración verificando la visualización de la comparsa en pista, los estados del cronograma y el botón de actualización.
   - [`voting-api.test.js`](file:///home/guido/dev/Proyectos/Carnavales2027_v2/api/src/tests/voting-api.test.js): validación de que el endpoint exponga `troupes` y `activeTroupe` correctamente a lo largo del ciclo de vida de la noche.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run src/tests/AdminVotingPage.test.jsx` en `client/` | 4/4 aprobados (222 ms; incluye prueba de control de pista RF-194) |
| `node --test src/tests/voting-api.test.js` en `api/` | 2/2 aprobados (550 ms; ciclo completo con estado de pista) |
| `npm test` en `api/` | 142/142 aprobados en 5 suites (28.59 s) |
| `npm test` en `client/` | 247/247 aprobados en 40 suites (7.52 s) |
| `npm run build` en `client/` | Exitoso en 935 ms (68 módulos; CSS 103.42 kB, JS 380.35 kB) |
| `git diff --check` | 0 advertencias / 0 errores |

---

## Cierre de Especificación Spec 025

- **Fase 1 (Home del Jurado):** Bloqueo secuencial, candados visuales, accesibilidad y cálculo por orden de salida — **100% Cerrada**.
- **Fase 2 (Planilla de Jurado):** Guardia contra URLs directas a comparsas futuras y banner de continuidad entre pasadas — **100% Cerrada**.
- **Fase 3 (Backend Defense):** Integridad transaccional en `saveScoreLocked`, error 409 `TROUPE_PRECEDENCE_REQUIRED` — **100% Cerrada**.
- **Fase 4 (Mesa de Control / Admin):** Control de comparsa activa en pista, cronograma secuencial de pasadas y actualización en vivo — **100% Cerrada**.


