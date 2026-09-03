# AGENTS.md — Carnavales2027_v2

## Propósito
Carnavales2027_v2 es una plataforma configurable de gestión y votación para Carnavales. Goya 2027 es una configuración inicial de referencia; cantidades, especialidades, categorías y rubros no deben convertirse en constantes globales ni lógica fija en el código.

---

## Estado Operativo Vigente

* **Spec 004:** cada ítem debe quedar `SCORED` (1 a 10) o `NOT_PRESENTED` (0 por acción explícita). `PENDING` bloquea la confirmación y el cierre.
* **Spec 005 / I4-A:** Conexión y sincronización Offline-First son una funcionalidad futura. Existe código exploratorio en el árbol, pero no constituye una capacidad operativa aceptada ni autoriza subsanaciones, penalizaciones, escrutinio, resultados ni actas.
* **Spec 006:** no se permiten nuevas reaperturas de planillas. Si ADMIN intenta cerrar con pendientes, la votación sigue abierta y recibe un modal con jurado, comparsa, rubro e ítem faltante. Las planillas históricas ya `REOPENED` solo pueden finalizar en `SUBMITTED`; el modal fue validado manualmente con teclado, lista extensa y viewports operativos.
* **Spec 007:** cada decisión confirmada por un jurado queda inmutable por ítem; el modal de confirmación fue validado manualmente con teclado, emulación táctil y viewports operativos.
* **Spec 008:** las invitaciones de `VEEDOR`, `COMISARIO` y `SCRUTINEER` persisten solo como hash, vencen y se consumen una vez. El alta se realiza desde Personas; emisión, aceptación, login y 2FA están validados automáticamente y la UI fue validada manualmente con teclado, emulación táctil y viewports operativos.
* **Spec 009:** rediseño visual del jurado implementado y validado automáticamente y con comprobación manual en responsive, teclado y emulación táctil (390x844, 768x1024 y 1440x900). Aceptada y cerrada el 2026-09-01.
* **Spec 010:** consolidación de puntajes por rubro, ganador por rubro, ranking de Mejor Comparsa (exclusivamente rubros nominativos), desempate por criterios 1 (rubros ganados) y 2 (Mejor Batería) y guardias de integridad de liberación (RF-94a). Validada y cerrada el 2026-09-02.
* **Spec 011:** sorteo ceremonial (criterio 3 de desempate) con countdown accesible, selección aleatoria criptográfica y cadena de auditoría JCS/SHA-256; validada automáticamente y con comprobación manual en 3 viewports. Cerrada el 2026-09-02.
* **Spec 012:** simplificación a planilla 100% online; retira el uso operativo de outbox y cache local en el cliente actual. Validada automáticamente y con comprobación manual. Cerrada el 2026-09-02.
* **Spec 013:** suplencias priorizadas: pares fijos titular/suplente, activación ADMIN+2FA con motivo ante titular ausente o incompleto, transición `REPLACED` y preservación histórica sin bloqueo de cierre ni resultados. Validada y cerrada el 2026-09-02.
* **Módulos diferidos:** penalizaciones (comisariato), escrutinio operativo y actas oficiales, publicación externa de resultados y Offline-First operativo. El `5 por equidad` es nulo para planillas digitales: la completitud obligatoria previene la omisión humana que buscaba subsanar.

---

## Contrato SDD Obligatorio

Antes de modificar código o artefactos SDD que afecten el comportamiento del sistema, el agente **debe**:
1. Leer `docs/constitution.md`.
2. Leer `docs/source-map.md`.
3. Consultar `docs/sdd-status.md` para identificar el incremento vigente y los módulos diferidos.
4. Leer `spec.md`, `clarifications.md`, el plan aprobado (`plan.md` o el artefacto referenciado en `.hermes/plans/`) y `tasks.md` del incremento afectado.
5. Leer `validation.md` del incremento afectado y de cualquier incremento previo impactado.

### Flujo de Trabajo
> **Constitución → Spec → Clarificación → Plan → Tareas → Implementación → Validación**

---

## Reglas de Alcance

* **Rol de artefactos:** La `spec.md` define *qué* y *por qué*; el `plan.md` define *cómo*.
* **Cero código sin spec:** No implementar ninguna capacidad sin una spec y tareas aprobadas para el incremento actual.
* **Spec-First:** Ante un requisito nuevo o cambio de comportamiento, actualizar primero spec, clarificaciones, plan y tareas; recién después modificar código.
* **Atomicidad:** Cada tarea implementa una unidad acotada y se detiene tras su validación. No anticipar tareas posteriores.
* **Evidencia mandatoria:** Un requisito no está cumplido por la mera existencia de código: exige test o verificación concreta.
* **SDD proporcional:** Aplicar el proceso según riesgo e impacto: un cambio trivial requiere implementación y verificación; un cambio funcional, de seguridad, datos o alcance requiere los artefactos SDD correspondientes.
* **Manejo de dudas:** Ante contradicciones entre fuentes, marcar `[NECESITA ACLARACIÓN]`. Jamás inferir reglas de negocio, reglamentarias o de seguridad. Las decisiones técnicas no definidas deben respetar la Constitución, el plan aprobado y los patrones existentes; si afectan arquitectura, datos, seguridad o comportamiento, documentarlas antes de implementar.

---

## Fuentes de Verdad

| Fuente | Uso / Prioridad |
| :--- | :--- |
| **Reglamento aprobado** | Norma funcional suprema ante cualquier conflicto. |
| **Confluence C2** | Contexto, reglas de negocio y decisiones compartidas. |
| **Jira SVC2** | Estado, responsable, backlog y criterios de aceptación del trabajo. |
| `docs/source-map.md` | Mapa de trazabilidad entre fuentes y artefactos del repositorio. |
| `specs/` | Contrato ejecutable y vigente de cada incremento. |
| **Código y pruebas** | Evidencia de implementación real. |

> *Nota:* No usar el título de un ticket como regla funcional completa. No convertir notas históricas o borradores en reglas superiores al reglamento vigente.

---

## Invariantes de Ingeniería

* **Arquitectura:** Mantener `api/` y `client/` estrictamente separados por responsabilidad.
* **Persistencia:** Usar PostgreSQL con migraciones incrementales, reproducibles y no destructivas.
* **Autenticación vs Dominio:** Mantener identidad y sesiones de Better Auth separadas de roles y entidades de dominio del carnaval.
* **Autorización:** Aplicar autorización estricta en el servidor/API. Las guardas en la UI son únicamente para experiencia de usuario (UX).
* **Configuración Dinámica:** Mantener Goya 2027 como configuración inicial, nunca hardcodeada en la lógica del producto.
* **Cobertura:** Toda regla crítica de dominio debe contar con prueba automatizada o verificación reproducible.
* **Accesibilidad & Responsive:** Interfaces operativas usables en móvil, tablet y desktop. No depender de `:hover` ni precisión de puntero para acciones críticas. Respetar contratos de foco, contraste y prevención de error táctil.
* **Secretos:** Prohibido commitear credenciales, tokens, contraseñas o URLs sensibles en Git, logs o documentación.

---

## Seguridad y Operaciones Restringidas

* Prohibido hacer `push`, `merge`, deploy o cambios de producción sin autorización explícita.
* Prohibido ejecutar `DROP`, truncados destructivos de BD, esquemas o migraciones irreversibles sin autorización previa.
* Prohibido crear autoasignación pública del rol `ADMIN`.
* Exigir 2FA/OTP verificado para rutas protegidas cuando el incremento lo requiera (sesión primaria no basta).
* Prohibido eliminar o degradar al último `ADMIN` activo.
* Prohibido ampliar módulos diferidos (*penalizaciones, escrutinio o actas*) sin un incremento SDD explícito. Las modificaciones a Offline-First deben ajustarse exclusivamente a Spec 005 o a una spec posterior aprobada.
* El módulo de votación existente solo puede modificarse conforme a su spec vigente o una spec aprobada posterior.

---

## Validación y Reporte de Salida

Antes de marcar una tarea como completada, el agente debe:
1. Ejecutar la prueba específica y la suite de tests aplicable.
2. Ejecutar migración, `build`, `lint` y chequeo de tipos (`typecheck`) correspondientes.
3. Revisar el `git diff` confirmando ausencia de secretos y de cambios fuera de alcance.
4. Actualizar `tasks.md` y `validation.md` únicamente con evidencia real y comprobada.
5. Reportar en la respuesta:
   * Requerimientos Funcionales (RF) cubiertos.
   * Archivos modificados.
   * Comandos de prueba ejecutados y sus salidas/resultados.
   * Pendientes o bloqueos.

> **Regla de Cierre:** No declarar éxito si falta evidencia o si alguna validación falla.
