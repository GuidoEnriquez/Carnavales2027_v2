# Validación — Spec 011: Sorteo ceremonial

## Estado

- T01–T05 y T08 implementados y validados automáticamente el 2026-09-02.
- T06 — Comprobación manual del modal sorteo ceremonial: completada el 2026-09-02.
- T07 — Cierre: completado el 2026-09-02.

**Spec 011 CERRADA.**

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| API completa | `npm test` en `api/` | 80 passed, 0 failed. |
| Persistencia | `npm run db:test` en `api/` | 38 passed, 0 failed. |
| Cliente completo | `npm test` en `client/` | 73 passed, 0 failed; 24 archivos. |
| Build | `npm run build` en `client/` | Exitoso; 53 módulos transformados. |
| Migraciones | `npm run db:migrate` en `api/` | `No pending migrations`. Migraciones hasta 061 en la base de test. |
| Revisión | `git diff --check` | Sin errores de whitespace. |

## Cobertura RF

| Requisito | Evidencia |
|---|---|
| RF-98 | `POST /api/v1/events/:eventId/tie-breaker/ceremonial-draw` (T02). |
| RF-99 | Validación de UUID, pool vacío y coincidencia exacta con el empate vigente (T02). |
| RF-100 | `useCountdown.js`, `CeremonialDrawModal.jsx` y tests cubren countdown 5→0 y revelación (T03, T04). |
| RF-101 | `crypto.randomInt()` y nonce de trazabilidad (T01). |
| RF-102 | Cadena JCS/SHA-256, migración 058 y prueba de auditoría (T01, T02). |
| RF-103 | 2FA + `ADMIN`, `SCRUTINEER`, `ESCRIBANO`; invitación ESCRIBANO probada por API (T02). |
| RF-104 | Unique index parcial 054, bloqueo del evento y rechazo de duplicado (T02). |
| RF-105 | Modal con foco inicial, Tab trap, Escape y revelación persistente (T04). Comprobación manual completada en T06. |
| RF-106 | `GET` endpoint, `useCeremonialDraw.loadRecorded`, recuperación en modal y vista (T08). |

## Comprobación manual — T06

### Checklist de validación (390×844, 768×1024, 1440×900)

**Preparación:**
1. Abrir Chrome DevTools → togglear Device Toolbar (Ctrl+Shift+M).
2. Seleccionar viewport: `iPhone SE` (390×844), `iPad` (768×1024), `Desktop` (1440×900).
3. Navegar a `#/admin/results`, seleccionar un evento con empate ceremonial activo.

**En cada viewport, verificar:**

| # | Criterio | Pass/Fail |
|---|----------|-----------|
| 1 | El botón "Iniciar sorteo ceremonial" es visible y tiene contraste WCAG AA. | ✅ |
| 2 | Al hacer tap/click, el foco se mueve al botón "Cancelar" del countdown. | ✅ |
| 3 | El countdown muestra 5, 4, 3, 2, 1, 0 — un cambio por segundo. | ✅ |
| 4 | El countdown NO depende de hover ni eventos del mouse. | ✅ |
| 5 | Tap en "Cancelar" detiene el countdown y cierra el modal. | ✅ |
| 6 | Al reabrir, tap en "Iniciar" y dejar llegar a 0, se revela la ganadora. | ✅ |
| 7 | El resultado revelado tiene texto legible (contraste AA) y es persistente. | ✅ |
| 8 | Tap en "Cerrar resultado" devuelve el foco al botón disparador. | ✅ |
| 9 | `Escape` cierra el modal en cualquier fase. | ✅ |
| 10 | `Tab` recorre los elementos focuseables sin salir del modal. | ✅ |
| 11 | No hay scroll horizontal roto ni contenido superpuesto. | ✅ |
| 12 | La ganadora mostrada coincide con la registrada en auditoría. | ✅ |

**Resultado:** 12/12 PASS en los 3 viewports. Sin hallazgos bloqueantes.

## Dudas / límites actuales

- El nonce se registra para trazabilidad; `crypto.randomInt()` no pretende ser reproducible.
- `SCRUTINEER` es el identificador técnico único; la migración 056 consolida asignaciones históricas de `ESCRIBANO`.
- La ruta manual `TIE_BREAKER_REQUIRES_MANUAL_DRAW` de Spec 010 se conserva hasta completar Spec 011.
