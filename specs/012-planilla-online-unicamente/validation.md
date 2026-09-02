# Validación — Spec 012

## Estado

Implementación, validación automatizada y comprobación manual completadas el 2026-09-02.

**Spec 012 CERRADA.**

## Evidencia

| Área | Comando | Resultado |
|---|---|---|
| Cliente | `npm test` en `client/` | 73 passed, 0 failed. |
| Build | `npm run build` en `client/` | Exitoso; 53 módulos transformados. |
| API | `npm test` en `api/` | 80 passed, 0 failed. |
| DB | `npm run db:test` en `api/` | 38 passed, 0 failed. |

`JudgeBallotPage.test.jsx` verifica `PUT`/`POST` online, red caída sin persistencia local nueva y ausencia de controles de sincronización.

## Comprobación manual — T04

### Checklist de validación (390×844, 768×1024, 1440×900)

**Preparación:**
1. Abrir Chrome DevTools → togglear Device Toolbar (Ctrl+Shift+M).
2. Seleccionar viewport: `iPhone SE` (390×844), `iPad` (768×1024), `Desktop` (1440×900).
3. Navegar a `#/jury/ballot` con un jurado asignado a una noche (simular apertura de planilla).

**En cada viewport, verificar:**

| # | Criterio | Pass/Fail |
|---|----------|-----------|
| 1 | La planilla carga correctamente sin errores de layout. | ✅ |
| 2 | Los rubros se muestran en lista con nombres y puntajes visibles. | ✅ |
| 3 | El selector de puntaje (1–10) responde a tap sin depender de hover. | ✅ |
| 4 | El botón "Guardar" es visible y accesible táctilmente. | ✅ |
| 5 | Guardar con conexión activa persiste el puntaje (responde 200). | ✅ |
| 6 | Guardar sin conexión muestra error accionable (no persiste local). | ✅ |
| 7 | El botón "Confirmar planilla" está deshabilitado hasta completar todos los rubros. | ✅ |
| 8 | Confirmar planilla muestra feedback inmediato (éxito/error). | ✅ |
| 9 | No hay controles de sincronización ni estados offline visibles. | ✅ |
| 10 | `Tab` recorre los rubros y puntajes correctamente. | ✅ |
| 11 | `Escape` no cierra la planilla accidentalmente. | ✅ |
| 12 | No hay scroll horizontal roto ni contenido superpuesto. | ✅ |

**Resultado:** 12/12 PASS en los 3 viewports. Sin hallazgos bloqueantes.
