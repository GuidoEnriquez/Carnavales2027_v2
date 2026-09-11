# Spec 028 — Panel del jurado por jerarquía + planilla un-ítem-por-vez (presentación, sin cambio de negocio)

## Estado

- **Fase SDD:** Especificación ratificada sobre implementación validada (2026-09-11). Dirección de producto por briefs TAREA 1/2 y FASE 1/2/3 + FIX sticky.
- **Fuentes:** `client/src/pages/JudgeHomePage.jsx`, `client/src/pages/JudgeBallotPage.jsx`, `client/src/index.css`, `client/src/styles/components.css`, suites `JudgeHomePage`/`JudgeBallotPage(V3)`; briefs de tarea del producto.
- **Relación:** No altera Specs 004/006/007/008/010/011/013/014/015/017/019-024. Solo presentación, jerarquía, navegación y UX writing del área JUDGE. Reutiliza bloqueo secuencial existente (ver Spec 025, aún en aclaración; no se crea dependencia nueva).

---

## Objetivo

`#/judge` responde primero "¿qué tengo que hacer ahora?" (AHORA / EVALUADAS / PRÓXIMAS) y `#/judge/ballot` evalúa un ítem activo por vez, con tablet como plataforma prioritaria y desktop como "misma experiencia, más contexto".

---

## Alcance

### Incluye

1. Home: protagonista única (primera accionable con progreso, si no la primera habilitada), EVALUADAS compacta con acción secundaria, PRÓXIMAS compacta sin botones disabled y explicación única del orden de pasada, CTA primario único, progreso "X de Y comparsas confirmadas".
2. Ballot: tarjeta única como flujo principal (se elimina toggle tarjeta/lista y lista completa), header compacto con comparsa activa, progreso "X de N puntuaciones · %", navegación Anterior/Ítem X de N/Siguiente integrada al contenido, resuelto compacto ("N puntos / Decisión registrada").
3. Táctil tablet-first (64px en 768–1120), mobile 390 sin overflow, desktop con rail lateral único sticky (navegación + resumen, hijos estáticos), resumen contextual con salto por `activeItemIndex`, banner "Lista para revisar", readonly como resumen de lectura, hint de atajos solo desktop.
4. Sin indicador online/sync: no existe fuente real (Spec 012); prohibido simularlo.

### Excluye

- Cambios de backend, endpoints, DTOs, estados, reglas de negocio, inmutabilidad (Spec 007), completitud (Spec 004), bloqueo secuencial, submit.
- `JudgeBallotShell` (descartado: el drawer es global; ocultarlo por ruta duplicaría sign-out).
- `aria-pressed` en puntajes (descartado: son acciones con modal, no toggles).

---

## Supersesiones de Spec 021 (ordenadas por producto)

- **RF-184 (alternador tarjeta/lista):** superado. La tarjeta única es el flujo en todos los viewports. Test migrado a "tarjeta única sin toggle".
- **RF-188 (barra inferior fija):** superado en forma, preservado en función. La navegación (Anterior/contador/Siguiente/Faltantes) vive integrada a la tarjeta con mismos nombres accesibles; el test RF-188 pasa intacto.
- **RF-189 (lista central en desktop):** superado. Desktop usa rail + resumen en vez de lista completa.
- **Copy:** CTA con sufijo `→` ("Continuar evaluación →", "Ver planilla →") por orden directa de producto; prevalece sobre la guía Spec 026.

---

## Criterios de aceptación

- Una única comparsa protagonista; cerradas y bloqueadas compactas; sin botones disabled en próximas; CTA primario único.
- Un ítem activo por vez; sin lista simultánea; progreso simplificado; navegación integrada; faltantes y submit intactos.
- Tablet prioritaria, mobile sin overflow, desktop con contexto sin cambiar el modelo.
- Suite cliente y build en verde (salvo fallos preexistentes de entorno documentados en validación).
