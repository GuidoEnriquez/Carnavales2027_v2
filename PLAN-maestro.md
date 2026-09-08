# Plan Maestro — Evolución de Diseño, Usabilidad y Arquitectura · Carnavales2027_v2

> **Estado:** Propuesta aprobada para discusión el 2026-09-07. No autoriza por sí sola cambios de comportamiento: cada fase se ejecuta como incremento SDD (spec → clarificaciones → plan → tareas → implementación → validación) conforme a `AGENTS.md`. No contiene código de vistas ni controladores.

## Context

Carnavales2027_v2 es una plataforma de **puntuación por jurados** para las noches de competencia de un carnaval (configuración de referencia: Goya 2027). Reemplaza las planillas de papel. Stack: Express 5 + PostgreSQL + Better Auth (API), React 19 + Vite con CSS plano (cliente). Se desarrolla bajo Spec-Driven Development (SDD) estricto: 18 specs, 67 migraciones, ~250 tests. AGENTS.md prohíbe implementar capacidades sin spec aprobada, por lo que **este plan se estructura como incrementos SDD (Spec 019 en adelante)**.

El pedido original asumía un sistema de voto popular con alta concurrencia. La exploración muestra otra realidad: votan entre 3 y 6 jurados por noche, autenticados con 2FA, sobre una BD con inmutabilidad por trigger. Eso reorienta el plan: el valor está en (a) reducir la fricción y el riesgo de error del jurado bajo presión, (b) endurecer seguridad en los puntos realmente expuestos, (c) consolidar deuda técnica del cliente, y (d) abrir el único frente de tráfico masivo que sí existe: el portal público de resultados.

### Decisiones de producto tomadas en esta sesión (2026-09-07)

| Tema | Decisión | Consecuencia |
|---|---|---|
| Identidad visual | **Híbrido por capas.** Marca carnaval en login, home, portal público y resultados. Pantallas operativas del jurado siguen sobrias, oscuras e institucionales. | El brief `client/AGENTS.md` (2026-09-01) se amplía con una "capa de marca", no se revoca. |
| Voto popular | **No.** Solo jurados. | Concurrencia tratada como carreras de estado, no como volumen. Sin anti-fraude de votantes anónimos. |
| Portal público | **Sí, como spec nueva** (módulo hoy diferido). | Fase propia con spec, caché y protección de tráfico. |

---

## 1. Análisis de contexto y lógica

### 1.1 El sistema en un párrafo

Un `ADMIN` configura el evento (noches, comparsas, especialidades, rubros, ítems) y lo abre, momento en que la configuración queda bloqueada por triggers. Invita jurados y perfiles operativos; nadie se registra solo. Asigna jurados titulares y suplentes fijos por noche y especialidad, con cupo. Al abrir la votación de una noche se crea una planilla por jurado titular con un `ballot_score` por ítem × comparsa programada. El jurado resuelve cada ítem con 1-10 o "No se presentó" (0); cada decisión confirmada es **inmutable por ítem** (HTTP 409), y la planilla confirmada no se reabre. `PENDING` bloquea confirmar y cerrar. El voto es secreto durante la competencia. Un `VEEDOR` ve solo conteos. El `COMISARIO` carga penalizaciones antes de la liberación. Solo `SCRUTINEER`/`ESCRIBANO` liberan resultados, sortean empates con `crypto.randomInt()` y emiten el acta sellada con SHA-256/JCS e inmutable por trigger. Resultados = suma simple de notas confirmadas; Mejor Comparsa = Σ rubros nominativos − penalizaciones (piso 0); desempate por rubros ganados, luego Batería, luego sorteo.

### 1.2 Lo que está bien y no hay que tocar

- Integridad en la BD, no en la app: ~40 triggers PL/pgSQL, CHECK de estado semántico (`PENDING⇔NULL`, `SCORED⇔1..10`, `NOT_PRESENTED⇔0`), unicidad `ballot_score(ballot_id, evaluation_item_id, night_schedule_id)`, una planilla activa por jurado y noche, append-only en auditoría.
- Concurrencia por bloqueo pesimista con orden consistente (evento → noche → ventana → planillas → scores), 41 `FOR UPDATE`, advisory locks para invariantes no filables (último ADMIN, aceptación de invitación en dos fases). Carreras probadas: cupos, suplente vs. confirmación.
- Secretos solo como hash, 2FA universal, sesión única por usuario, segregación de funciones (ADMIN excluido de liberar, sortear y certificar), auditoría con filtro de campos sensibles.
- Modelo de datos del dominio y fórmula de resultados: **no requieren refactorización**. La "Fase 1: Refactorización de BD" del pedido no se justifica; se reemplaza por endurecimiento puntual (§3).

### 1.3 Cuellos de botella y problemas detectados

Ordenados por impacto. "Evidencia" cita archivo y línea verificados en esta sesión.

**A. Fricción operativa del jurado (impacto: alto, es el usuario en campo)**
1. Cada puntaje cuesta 2 taps + 1 modal, sin deshacer. Con 60 ítems por noche son 120 taps y 60 modales. El modal es la única defensa contra el mis-tap porque la decisión es irreversible al instante (Spec 007). Evidencia: `client/src/pages/JudgeBallotPage.jsx:266,308-332`.
2. Un lock global `busy` deshabilita los 10 botones de todos los ítems mientras hay un guardado en vuelo; con red lenta en el corsódromo, toda la planilla se congela. Evidencia: `JudgeBallotPage.jsx:266`.
3. Sin reintento por fila ante fallo de red; el jurado debe recordar qué ítem falló. El indicador "Guardado" depende de igualdad de string con el mensaje (`JudgeBallotPage.jsx:279`).
4. Grilla 1-10 modelada como `role="group"` de botones, no como `radiogroup`: ~660 tab stops por noche y sin flechas.
5. `JudgeHomePage` hace N+1 fetch (un GET por planilla para contar). `JudgeAssignmentPage` es inalcanzable y tiene un botón sin `onClick`.
6. Sin `navigator.onLine` ni degradación visible: la app "100% online" no comunica la pérdida de red hasta que un guardado falla.

**B. Seguridad: superficie expuesta sin límite de intentos (impacto: alto)**
7. **Rate limiting inexistente** en API y en las 18 specs (grep: 0 resultados). Afecta login, verificación OTP de 6 dígitos (10^6 combinaciones, ventana 5 min) y los endpoints públicos `inspect`/`accept` de tres sistemas de invitación, montados antes del guard de sesión. Evidencia: `api/src/app.js:42`, `api/AGENTS.md:61` lo exige pero nadie lo implementó.
8. Sin `helmet` ni cabeceras de seguridad (HSTS, CSP, X-Frame-Options). Sin límite de body explícito. Pool `max 10` sin `statement_timeout` ni `connectionTimeoutMillis`: un `FOR UPDATE` colgado puede agotar el pool.
9. `audit_event` es append-only pero **no encadenada**; solo el sorteo ceremonial tiene hash chain. Un superusuario puede deshabilitar el trigger y reescribir historia sin detección.

**C. Defectos de lógica (impacto: medio-alto, afectan el escrutinio)**
10. **Rama muerta en la certificación del acta.** `scrutiny-record-service.js:118` comprueba `bestTroupe.status === "REQUIRES_CEREMONIAL_DRAW"`, pero `determineBestTroupe` (`results-service.js:324-342`) nunca devuelve `status`; `resolveTieBreaker` lanza `TIE_BREAKER_REQUIRES_MANUAL_DRAW`. Un empate sin sortear al certificar propaga un error crudo en vez del 409 `TIE_BREAKER_PENDING` que la Spec 015 exige. Probable causa del "fallo intermitente de prueba de Acta Oficial" anotado en Spec 017 T08.
11. **RF-18 (Spec 001) nunca implementado**: conservar solo rubros aleatorios cuando una comparsa incumple el mínimo de integrantes. Se difirió a penalizaciones (Spec 014) y allí se omitió.
12. `AdminResultsPage.jsx:32` prefiere un evento hardcodeado llamado `"test_prueba"`: lógica de seed en código de producción.
13. Los tests de API/BD se **saltan silenciosamente** si falta `TEST_DATABASE_URL`; una corrida verde no garantiza cobertura. No hay CI, lint ni typecheck.

**D. Deuda de arquitectura del cliente (impacto: medio, frena toda mejora UX)**
14. `index.css` (3015 líneas) tiene **dos `:root`**: tema claro (l.1) y tema oscuro (l.~952) que lo sobreescribe selector por selector. Un tercio del archivo son reglas muertas. Tokens escasos, colores hex repetidos, "Inter" nunca cargada, pesos no estándar (760, 850). Organizado por historia de specs, no por componente.
15. Un solo componente compartido (`AppNavigation`). Modales implementados de tres formas; tres guards `Require*Role` idénticos; tres páginas de aceptación casi iguales; lógica rol→ruta triplicada; mapas error→copy inline por archivo; idioma de cancelación de fetch repetido en ~10 páginas.
16. Sin router: hash routing manual, sin lazy loading; todas las páginas se importan al arranque.
17. PWA nominal: manifest sin `icons` (no instalable), service worker app-shell que excluye `/api`. Store IndexedDB cifrado (AES-GCM) bien hecho pero huérfano.

**E. Deuda documental (impacto: bajo-medio, riesgo de ambigüedad)**
18. Colisiones de numeración RF entre specs (005/006/008, 011/012/013, 015/016/017). `ESCRIBANO` ausente del diccionario RF-63. Spec 011 se contradice sobre quién puede sortear. Spec 009 "cerrada" en `sdd-status.md` pero T05 "en curso" en `tasks.md`. Escala-ancla 1-10 de Spec 018 es un supuesto sin confirmar contra reglamento, con 9 y 10 compartiendo "Excelente".

---

## 2. Propuesta UX/UI (Frontend)

### 2.1 Identidad visual: "el carnaval es la marca, la planilla es el instrumento"

Modelo de dos capas sobre un único sistema de tokens:

| Capa | Pantallas | Carácter |
|---|---|---|
| **Marca** | Login, Home por rol, Portal público, Resultados liberados, Acta impresa | Vibrante y festiva: tipografía display, acentos cálidos (magenta, dorado, turquesa), textura de plumas/lentejuelas muy sutil en fondos, micro-animaciones respetando `prefers-reduced-motion`. |
| **Instrumento** | Planilla del jurado, Asignaciones, Votación admin, Penalizaciones, Escrutinio, Monitor VEEDOR | Sobrio, oscuro, alto contraste. Sin distracciones. La única "alegría" es el color de la especialidad y el escudo/color de cada comparsa como ayuda de reconocimiento. |

Mecanismo: tokens semánticos (`--surface`, `--text`, `--accent`, `--brand-*`) con `data-layer="brand" | "instrument"` en el shell. La capa cambia acentos y tipografía display, nunca el contraste ni el tamaño de los controles operativos. Cada comparsa recibe un color de identidad configurable (campo nuevo `event_troupe.brand_color`, opcional) que aparece como banda lateral en cards y sidebar: refuerza "estoy puntuando la comparsa correcta" sin depender del texto.

Paleta de marca sugerida para discusión (a validar con contraste AA sobre fondo oscuro): magenta carnaval `#E11D74`, dorado `#F5B301`, turquesa `#14B8A6`, sobre el azul noche vigente `#090D16`. El rojo `#8f2e22` que hoy está en el manifest y nunca se usa pasa a ser el color del acta/sello.

### 2.2 Mobile-first para el jurado (390×844 es el viewport primario)

- **Un ítem por pantalla en móvil** (flujo "tarjeta a tarjeta"), con la comparsa, el rubro y el nombre del ítem siempre visibles arriba; lista completa como vista alternativa. Reduce la carga de las 11 opciones a una decisión con contexto.
- **Grilla 1-10 como `radiogroup` real** de 2×5 con botones ≥56px, palabra-ancla siempre legible (mínimo 0.85rem, corrige el ancla de ~10px en desktop), y "No se presentó" en región propia, separada por espacio y color, bajo la grilla.
- **Confirmación con deshacer en vez de modal por ítem.** Reemplazar el modal de cada puntaje por: tap → el botón muestra "8 · Muy bueno ✓ Confirmar" como segundo tap en el mismo lugar (evita mis-tap adyacente) → guardado con un toast "Guardado · Deshacer (5 s)". La inmutabilidad se aplica cuando expira la ventana o cuando el jurado avanza. Esto **requiere spec** porque cambia el contrato de Spec 007 (el servidor hoy bloquea al primer guardado). Alternativa sin tocar el backend: mantener el modal solo para "No se presentó" y para el cierre de planilla, y usar el doble tap in situ para 1-10 (la decisión sigue siendo inmutable al confirmar el segundo tap). Recomendación: **alternativa sin backend primero**, medir con jurados, luego evaluar deshacer.
- **Guardado por fila, no global**: estado `idle | saving | saved | error` por `scoreId`, con botón "Reintentar" inline. Nunca congelar otros ítems.
- **Barra inferior fija** con progreso "6 / 12", anterior/siguiente por ítem, y acceso a "Faltantes" que abre la lista de pendientes con salto directo.
- **Estado de red honesto y no intrusivo**: pill "Sin conexión" derivada de `navigator.onLine` + resultado del último request; texto "Podés seguir mirando; los puntajes se guardan al recuperar señal" solo si Offline-First se aprueba. Mientras siga online-only: "Reintentá cuando vuelva la señal".
- **Tablet (768×1024)**: dos columnas, lista de ítems a la izquierda, decisión a la derecha. **Desktop (1440×900)**: sidebar de comparsas + lista + decisión, atajos de teclado 1-0 y Enter en `radiogroup`.

### 2.3 Accesibilidad y prevención de error

- Objetivos WCAG 2.2 AA verificados con axe en tests: corregir `.nav-section-label` (≈2.2:1), skip-link a `<main>`, `<h1>` y landmark en pantallas de denegación, `<table>` real en ranking en lugar de divs con roles ARIA.
- `focus-visible` consistente, retorno de foco en todos los diálogos (hoy parcial), `aria-describedby` en todos, un único componente `<Dialog>` sobre `<dialog>` nativo.
- Prevención de error por diseño: nombre del ítem y comparsa visibles en el punto de decisión (ya iniciado en Spec 018), doble confirmación in situ para 1-10, modal solo para irreversibles de mayor alcance (No se presentó, Confirmar planilla), botones Cancelar/Confirmar nunca adyacentes en móvil, mensaje de cierre que nombra **todas** las comparsas (hoy solo la primera).
- Copy en lenguaje del jurado, no del dominio técnico: "Pendiente", "Puntuado 8 · Muy bueno", "No se presentó" en lugar de `PENDING`/`SCORED`. Diccionario único de códigos de error → copy en `client/src/i18n/errors.js`.

### 2.4 Otros roles

- Home por rol con tarjetas grandes y "próximo paso sugerido" (ya planificado en `PLAN-role-ux.md` Fase 5; se mantiene).
- Escrutinio: el stepper de 4 pasos existente gana un panel de "condiciones para liberar" con la lista de bloqueos de RF-94a legibles.
- VEEDOR: mismo monitor pero con actualización en vivo (§3.3) y una vista "pared de sala" para proyectar en el puesto de control.

---

## 3. Propuesta de Arquitectura y Seguridad (Backend)

### 3.1 Concurrencia: dónde está el riesgo real

Volumen esperado: decenas de escrituras por minuto en el pico, no miles por segundo. El diseño pesimista actual es correcto para este volumen. Las mejoras son de resiliencia, no de escala:

- **Timeouts del pool y de sentencias**: `statement_timeout` (p. ej. 5 s), `idle_in_transaction_session_timeout`, `connectionTimeoutMillis`; pool separado y pequeño para lecturas del portal público. Evita que una transacción colgada agote los 10 slots.
- **Idempotencia en el guardado individual y el submit** con header `Idempotency-Key` (UUID del cliente) persistido en `ballot_sync_operation`, reutilizando su PK `(actor_user_id, ballot_id, operation_id)` y `content_hash`. Hoy solo el endpoint `/sync` lo tiene; un doble tap o un reintento tras timeout en `PUT /scores/:id` recibe hoy un 409 `SCORE_IMMUTABLE` indistinguible de un conflicto real. Con idempotencia el reintento devuelve el mismo 200.
- **Reintento automático ante deadlock (`40P01`)** en `inTransaction()` con backoff corto, 2 intentos. Hoy no existe.
- **Carga sintética antes de cada noche**: script que simula 6 jurados × 60 ítems con jitter y latencia móvil, midiendo p95 y errores 409. Forma parte de la verificación, no del producto.
- **Portal público** (§3.4) es el único punto de concurrencia masiva y se aísla completamente del path de escritura.

### 3.2 Prevención de fraude y duplicados

Ya cubierto en BD (unicidad, inmutabilidad, secreto, 2FA, hash de invitaciones). Faltantes concretos:

1. **Rate limiting por capas** (spec nueva): límite por IP y por cuenta en `/api/auth/*` (login, resend), límites estrictos en los tres `inspect`/`accept` públicos (p. ej. 5 intentos / 15 min por IP + bloqueo temporal por token), límites laxos en `/api/v1` autenticado. Almacén en memoria con `express-rate-limit` en primera versión (una sola instancia); interfaz preparada para Redis si se escala.
2. ~~Bloqueo progresivo de OTP~~ **Verificado 2026-09-07: ya existe.** Better Auth 1.6.27 trae `accountLockout` activado por defecto en su plugin `twoFactor` (`node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs:109-116`): 10 intentos fallidos bloquean la cuenta 15 minutos (`lockedUntil` en la tabla `twoFactor`), citando NIST SP 800-63B §5.2.2. `api/src/auth/auth.js` no lo desactiva. No requiere trabajo nuevo; sí conviene un test explícito que lo documente como comportamiento esperado.
3. **Cabeceras de seguridad** con `helmet` y `express.json({ limit })` explícito; `trust proxy` para que el rate limit vea la IP real tras el reverse proxy.
4. **Encadenar toda `audit_event`**, no solo el sorteo: reutilizar `hashCeremonialDraw`/`canonicalizeJson` de `api/src/audit/audit-service.js` con una cabeza de cadena general y un job de verificación (`npm run audit:verify`) que recorra la cadena y falle ante cualquier ruptura. Migración aditiva; los eventos históricos quedan con `hash_chain_version = 0`.
5. **Alertas de anomalía operativa** en el monitor VEEDOR: puntaje guardado fuera de la ventana de la noche, jurado con planilla `OPEN` a X minutos del cierre, dos sesiones desde IPs distintas (Better Auth ya elimina sesiones previas; solo hay que emitir el evento).
6. **Cerrar la rama muerta del acta** (§1.3 #10) con test de regresión: certificar con empate sin sortear debe devolver 409 `TIE_BREAKER_PENDING`.

### 3.3 Tiempo real interno: SSE, no WebSockets

Para VEEDOR, ADMIN (estado de votación) y la pantalla de escrutinio, la necesidad es "servidor → clientes, pocos clientes, actualizaciones por evento". **Server-Sent Events** cubre eso con HTTP plano, reconexión automática, sin librería nueva ni handshake adicional, compatible con el `requireTrustedOrigin` y las cookies de sesión existentes:

- Endpoint `GET /api/v1/monitor/events/:eventId/stream` con los mismos guards `[requireSession, requireTwoFactor, requireVotingObserver]`.
- Fuente de eventos: `LISTEN/NOTIFY` de PostgreSQL disparado por trigger AFTER INSERT/UPDATE en `ballot` y `voting_window` (payload solo con `event_id`, `night_id`; el servidor recalcula los agregados y respeta RF-132: nunca puntajes ni nombres).
- Cliente: `EventSource` con fallback automático al polling actual de 15 s si la conexión falla dos veces. El código de polling de `VeedorMonitorPage.jsx` se conserva como fallback.
- Spec 016 dejó WebSockets "diferidos"; SSE es una decisión técnica distinta pero necesita constar en la spec del incremento.

### 3.4 Portal público de resultados (spec nueva, módulo hoy diferido)

- **Solo lectura, solo post-liberación.** Fuente: snapshot inmutable. Al ejecutar `releaseResults` (y tras cada sorteo/acta) se materializa `results_snapshot(event_id, version, payload JSONB, hash)`; el portal nunca toca `ballot_score`.
- Servicio separado o ruta `/public/*` sin sesión, sin `requireTrustedOrigin`, con `Cache-Control: public, max-age=30, stale-while-revalidate`, ETag por hash del snapshot, y CDN/reverse proxy delante. Con eso 10.000 personas refrescando cuestan un handful de lecturas a la BD.
- Tiempo real para el público: SSE público del canal "hay nueva versión" (sin datos), el cliente re-descarga el JSON cacheado. Fallback: polling de 30 s.
- Rate limit por IP generoso y respuesta estática ante saturación.
- Contenido: ranking por rubro, Mejor Comparsa con bruto/penalizaciones/neto, memoria de desempate, verificación del hash del acta. Nunca puntajes por jurado. Identidad de marca completa (capa "Marca").

### 3.5 Higiene de plataforma

- CI (GitHub Actions): Postgres de servicio, `npm test` API + `db:test`, tests de cliente, `vite build`, ESLint + `tsc --checkJs` gradual, `npm audit`, axe sobre páginas clave. El guard local de `TEST_DATABASE_URL` obligatoria ya existe (ver progreso de Fase 0 abajo); falta el workflow de CI en sí.
- Validación de entradas con un módulo compartido (`api/src/lib/validate.js`) que reemplace las ~8 copias de `requireText/requireUuid/requireInteger`; evaluar `zod` solo si el volumen lo justifica (Constitución: sin dependencias sin necesidad).
- Logger estructurado (pino) con request-id y sin secretos; graceful shutdown en `server.js`.
- Dockerfile + `compose.yml` de desarrollo (API, cliente, Postgres, proxy Caddy) y guía de despliegue same-origin.
- Mover `seed-event-test.js` a un script versionado con `configuration_seed` o eliminarlo. (El hardcode de `test_prueba` en `AdminResultsPage` ya se retiró, ver progreso de Fase 0.)

---

## 4. Plan de acción por fases

Cada fase es uno o dos incrementos SDD con spec, clarificaciones, plan, tareas y validación, siguiendo el flujo de `docs/constitution.md`. Las fases 1 y 2 son independientes y pueden avanzar en paralelo. Se recomienda no abrir la fase 3 hasta cerrar la 2.

#### Fase 0 — Cierre de lo abierto (1 semana)
Objetivo: partir de una base verificada y commiteada.

**Estado:** Completada y verificada el 2026-09-07.
- ✅ **Rama muerta del acta oficial (#10) corregida.** `scrutiny-record-service.js` compraba `bestTroupe.status === "REQUIRES_CEREMONIAL_DRAW"`, un campo que `determineBestTroupe` nunca devuelve: ante un empate no resuelto, la función *lanza* `TIE_BREAKER_REQUIRES_MANUAL_DRAW`. Consecuencia real (no solo cosmética): un evento que necesitó sorteo ceremonial **nunca podía certificar su acta**, incluso después de sortear, porque el código que consultaba el sorteo ya registrado era inalcanzable. Fix: capturar esa excepción y recién ahí buscar el sorteo. Test de regresión nuevo (`api/src/tests/scrutiny-record-ceremonial-draw.test.js`) confirmado como falla real sin el fix (revertí, corrió, falló con el código exacto equivocado; restauré, pasó). Este es probablemente la causa de la "intermitencia en prueba de Acta Oficial" anotada sin resolver en Spec 017/T08.
- ✅ **`test_prueba` (#12) retirado** de `AdminResultsPage.jsx`: ya no preselecciona un evento por nombre hardcodeado; usa el primero de la lista, como ya hacía de fallback. Test existente sigue pasando sin cambios (el nombre en el fixture del test es incidental).
- ✅ **Guard de `TEST_DATABASE_URL` (#13)** vía `pretest`/`predb:test` en `api/package.json`, apuntando a `api/src/scripts/assert-test-database-url.js`: si falta la variable, `npm test`/`npm run db:test` fallan con exit 1 y mensaje claro **antes** de que el test runner arranque, en vez de reportar "0 fallos" con todo salteado. Verificado en ambos sentidos. Los `skip:` por archivo quedan intactos como conveniencia para correr un test suelto sin BD.
- ✅ **Hallazgo que reduce el alcance de la Fase 1**: Better Auth 1.6.27 ya bloquea la cuenta 15 min tras 10 OTP fallidos, activado por defecto (ver §3.2 punto 2). No hace falta implementarlo.
- ✅ **Bug de segregación de funciones corregido (con confirmación del usuario).** `require-ceremonial-draw-access.js` admitía `ADMIN` en el sorteo ceremonial (GET y POST), contradiciendo el propio RF-103 de Spec 011 y la decisión explícita de `clarifications.md` ("ADMIN no debe ver ni operar el escrutinio"). El código, el test y `validation.md` habían certificado la versión incorrecta el 2026-09-02; solo `spec.md` y `clarifications.md` tenían la regla correcta. Preguntado, el usuario confirmó restringir a `SCRUTINEER`/`ESCRIBANO`. Corregidos: middleware, comentario en `results.routes.js`, test (`results-ceremonial-draw.test.js`, ahora exige 403 para ADMIN en ambos métodos), `validation.md` y `tasks.md` de Spec 011.
- ✅ **Índice de colisiones de RF** (`docs/rf-index.md`, enlazado desde `docs/source-map.md`): detección automatizada y verificada de 22 colisiones reales en 4 clusters (004/008, 005/006/008, 011/012/013, 015/016/017) — más precisa que mi estimación informal original.
- ✅ `ESCRIBANO` documentado en el diccionario de roles de Spec 008 (RF-63), como corrección posterior sin reescribir el RF histórico.
- ✅ Spec 009: `tasks.md` T05 corregida de "en curso" a "completada", sincronizada con `validation.md` (que ya documentaba la comprobación manual del propio Guido el 2026-09-01).
- ✅ `seed-event-test.js`: no se borró (no tiene seguimiento en git, podía ser trabajo manual en curso), pero quedó documentado el estado inválido que produce (evento `CONFIGURING` con noche/planilla/ventana `OPEN`, fuera de cualquier flujo real) y la alternativa correcta ya existente (`seed-spec-006.js`).
- ✅ Verificado de punta a punta tras cada cambio: 123/123 tests API, 68/68 DB, 138/138 cliente, build de Vite exitoso, migraciones 001-067 sin pendientes.
- ⏸️ **No se tocó** (necesita al responsable de producto o una herramienta de navegador que este entorno no tiene): validación manual de Specs 016/018 en 390×844/768×1024/1440×900, la escala-ancla RF-162 (ver nota abajo), y las aclaraciones que bloquean Spec 017.

**Pendiente de este mismo ítem de la lista original:**
- Completar validación manual de **Spec 018** (T07, tres viewports) y de **Spec 016** (T016.7): requiere un dispositivo/navegador real o una herramienta de automatización de UI; no disponible en este entorno. Resolver o congelar formalmente **Spec 017** (T05/T10/T11 bloqueadas por aclaración de producto).
- **Escala-ancla RF-162** (`const SCORE_ANCHOR` en `JudgeBallotPage.jsx:14`): la propia Spec 018 exige que sea "configuración de producto, no hardcodeada", pero no hay reglamento en el repo para confirmar las palabras ni mecanismo de configuración existente para engancharla sin inventar una capa nueva (migración + UI admin), lo que sería ampliar alcance sin spec. Se deja marcado `[NECESITA ACLARACIÓN]`, no se resuelve por decisión unilateral.

### Fase 1 — Seguridad y plataforma (Spec 019 · 1-2 semanas)
- Rate limiting por capas, bloqueo progresivo de OTP, `helmet`, límite de body, `trust proxy`, timeouts de pool y sentencias, reintento por deadlock.
- Idempotencia en `PUT /scores/:id` y `POST /submit` reutilizando `ballot_sync_operation`.
- Cadena de hash en toda `audit_event` + `npm run audit:verify`.
- CI con Postgres, lint/typecheck, `npm audit`; Dockerfile y compose de desarrollo; logger estructurado.
- Validación: tests de límite de intentos (429 y auditoría), test de replay idempotente, test de ruptura de cadena detectada, carga sintética 6 jurados × 60 ítems.

### Fase 2 — Fundación del sistema de diseño (Spec 020 · 2 semanas)
Sin cambio de comportamiento; habilita todo lo visual posterior.
- Tokens únicos en `client/src/styles/tokens.css` (color semántico, escala tipográfica, espaciado, radios, sombras, z-index, tamaños táctiles). Eliminar el `:root` claro y las reglas muertas; partir `index.css` por componente (`styles/components/*.css`) con un `index.css` que solo importa.
- Cargar Inter (self-hosted, `font-display: swap`) y una tipografía display para la capa de marca; pesos estándar.
- Componentes compartidos mínimos: `Dialog` (sobre `<dialog>` nativo, reemplaza tres implementaciones), `RequireAnyRole` (reemplaza tres guards), `ProgressBar`, `StatusPill`, `Toast`, `Button`, `AcceptInvitationPage` parametrizada, hook `useApiResource`, `i18n/errors.js`. Mapa único rol→ruta en `auth/role-routes.js`.
- `data-layer` de marca/instrumento en el shell; `prefers-reduced-motion` y `prefers-contrast` respetados.
- Manifest con íconos, `theme_color` alineado; service worker mantenido como app-shell.
- Validación: snapshot visual por página (Playwright) en 3 viewports, axe sin violaciones críticas, tests existentes intactos (138 cliente).

### Fase 3 — Planilla del jurado v3 (Spec 021 · 2-3 semanas)
- Flujo tarjeta-a-tarjeta en móvil, `radiogroup` real, ancla legible, "No se presentó" separado, barra inferior con progreso/navegación/faltantes.
- Doble tap in situ para 1-10 (sin cambio de backend); modal solo para "No se presentó" y cierre de planilla.
- Estado de guardado por fila con reintento; eliminar `busy` global; indicador de red honesto.
- `JudgeHomePage` con endpoint agregado `GET /judge/ballots?include=progress` (elimina el N+1); `JudgeAssignmentPage` enlazada o eliminada.
- Color de identidad por comparsa (`event_troupe.brand_color`, migración aditiva, editable solo en `CONFIGURING`).
- Validación: tests de cliente por RF, prueba con 2-3 jurados reales en tablet y teléfono con red degradada (Chrome DevTools "Slow 3G"), métricas: taps por ítem, errores de mis-tap, tiempo por planilla.
- **Decisión diferida a clarificación**: ventana de deshacer de 5 s (cambia Spec 007; requiere regla reglamentaria sobre corrección de voto, hoy `[NECESITA ACLARACIÓN]` en Spec 001).

### Fase 4 — Tiempo real interno (Spec 022 · 1 semana)
- `LISTEN/NOTIFY` + SSE para monitor VEEDOR, estado de votación ADMIN y pantalla de escrutinio; fallback a polling.
- Alertas de anomalía operativa en el monitor.
- Vista "pared de sala" del monitor.
- Validación: test de que el stream nunca contiene puntajes ni nombres (RF-132), test de reconexión, test de fallback.

### Fase 5 — Capa de marca y home por rol (Spec 023 · 1-2 semanas)
- Rediseño de login, home por rol, resultados liberados y acta imprimible con la identidad carnaval.
- Completar `PLAN-role-ux.md` (panel resumen ADMIN, stepper de escrutinio con condiciones legibles).
- Validación: manual en 3 viewports, contraste AA verificado, reduced-motion.

### Fase 6 — Portal público de resultados (Spec 024) [COMPLETADA]
- ✅ `results_snapshot` materializado de forma inmutable (migración 070, triggers NO UPDATE/DELETE) en liberación, sorteo y emisión de acta oficial.
- ✅ Rutas públicas `/api/v1/public/*` (`/events`, `/:eventId/results` con ETag y HTTP 304, `/stream` con SSE público y fallback de polling a 30s).
- ✅ Secreto absoluto del voto (RF-214): exclusión estricta de cualquier referencia a jurados, notas parciales o planillas individuales.
- ✅ Portal Web de Resultados `PublicResultsPage.jsx` bajo Capa de Marca (`#/resultados`), tarjeta de honor para el campeón, tabla de ranking general accesible, ganadores por rubro, y verificación del acta notarial con copia del sello SHA-256.
- ✅ Validado con 141 tests de API, 72 de DB, 200 de cliente y build exitoso.

### Fase 7 — Reglas pendientes del reglamento (Spec 025 · según disponibilidad del reglamento)
- RF-18 (mínimo de integrantes → solo rubros aleatorios).
- Corrección de sorteo (`RESULTS_TIE_BREAKER_CORRECTION`), corrección autorizada de voto confirmado.
- Bloqueada hasta que el reglamento esté en el repositorio (Spec 005 clarificación 21).

### Fuera de este plan (explícito)
- Offline-First operativo: sigue diferido. La Fase 3 deja la UI preparada (estado por fila, indicador de red) y la Fase 1 deja la API preparada (idempotencia). Activarlo requiere una spec propia.
- Voto popular: descartado por decisión de esta sesión.

---

## 5. Archivos críticos y patrones a reutilizar

| Área | Archivo | Uso en el plan |
|---|---|---|
| Transacciones/locks | `api/src/modules/ballots/ballot-service.js` (`inTransaction` l.41, `lockJudgeBallot` l.73, `closeVoting` l.290) | Añadir reintento de deadlock e idempotencia; no alterar el orden de locks. |
| Idempotencia existente | `ballot-service.js:541-600` (`syncBallot`, `operationHash`), tabla `ballot_sync_operation` (migración 048) | Reutilizar para `PUT /scores` y `POST /submit`. |
| Hash chain | `api/src/audit/audit-service.js` (`hashCeremonialDraw` l.51, `canonicalizeJson` l.38, `auditCeremonialDraw` l.100) | Generalizar a toda `audit_event`. |
| Guards | `api/src/auth/*` (`requireTwoFactor`, `requireVotingObserver`, `trusted-origin.js`) | Reutilizar en SSE y portal (portal sin `requireTrustedOrigin`). |
| Monitor | `api/src/modules/monitor/monitor-service.js`, `client/src/pages/VeedorMonitorPage.jsx` | Fuente de agregados para SSE; polling actual como fallback. |
| Acta / empate | `api/src/modules/scrutiny-records/scrutiny-record-service.js:118`, `results-service.js:276-342` | Corregir rama muerta. |
| Resultados | `results-service.js:45-70` (SQL de consolidación), `releaseResults` l.356 | Punto de materialización del `results_snapshot`. |
| Planilla | `client/src/pages/JudgeBallotPage.jsx`, `client/src/tests/JudgeBallotPage.test.jsx` | Base de la Fase 3. |
| CSS | `client/src/index.css` (dos `:root`: l.1 y l.~952) | Se parte y tokeniza en Fase 2. |
| Componentes a consolidar | `client/src/auth/Require*Role.jsx`, `features/penalties/RevokePenaltyModal.jsx`, `features/results/CeremonialDrawModal.jsx`, `pages/Accept*InvitationPage.jsx` | Fase 2. |
| Brief de diseño | `client/AGENTS.md` | Ampliar con la capa de marca (§2.1) y la decisión de esta sesión. |
| Estado SDD | `docs/sdd-status.md`, `docs/source-map.md`, `README.md` | Registrar Specs 019-025 y las decisiones de producto. |

---

## 6. Verificación del plan (cómo sabremos que funcionó)

- **Por fase**: cada spec cierra con `validation.md` con evidencia real (tests, build, manual en 390×844 / 768×1024 / 1440×900, teclado y táctil), como exige AGENTS.md.
- **Métricas UX (Fase 3)**: taps por ítem (objetivo ≤2 sin modal), tiempo medio por planilla, tasa de "No se presentó" accidental (objetivo 0 en prueba con jurados), puntuación axe sin violaciones críticas.
- **Métricas de seguridad (Fase 1)**: 429 tras N intentos en login/OTP/accept; replay idempotente devuelve 200 idéntico; `audit:verify` detecta una fila alterada en test.
- **Métricas de resiliencia**: carga sintética 6 jurados × 60 ítems con latencia móvil sin errores 5xx ni agotamiento de pool; SSE reconecta y cae a polling.
- **Portal (Fase 6)**: 1.000 conexiones concurrentes con p95 < 300 ms sirviendo desde caché; cero lecturas a `ballot_score`.
- **Global**: CI verde obligatoria con Postgres real; `npm run db:migrate -- --status` sin pendientes en cadena fresca 001-0NN.

## 7. Riesgos y aclaraciones que necesitan al responsable del producto

1. **Reglamento no está en el repositorio**: bloquea Fase 7 y la decisión de "deshacer" de Fase 3. Pedirlo como primer paso.
2. **Escala-ancla 1-10**: confirmar palabras y si 9/10 se distinguen.
3. **Doble tap vs. modal por ítem**: probar con jurados reales antes de cambiar; la spec 007 sigue vigente hasta entonces.
4. **Portal público**: definir qué se publica y cuándo (¿al liberar o al certificar el acta?), y si se muestran penalizaciones con motivo.
5. **SSE**: consta en spec como decisión técnica que reemplaza el "WebSockets diferidos" de Spec 016.
6. **Better Auth 1.6**: verificar qué protección de fuerza bruta trae de fábrica antes de implementar la propia.
