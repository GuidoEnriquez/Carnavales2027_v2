# Spec 004 - Completitud obligatoria de planillas

## Estado

- **Fase SDD:** implementado, validado y aceptado el 2026-08-31.
- **Fuentes:** decisión de producto del 2026-08-30 registrada en `docs/source-map.md`; RF-07 a RF-11 y RF-15 de Spec 001.
- **Nota de trazabilidad:** el reglamento citado por producto no está distribuido en este repositorio. La COC todavía no aprobó una resolución sobre la aplicación del `5 por equidad` a nuevas planillas digitales; esta spec no declara su eliminación ni implementa esa contingencia.

## Objetivo

Eliminar la ambigüedad entre una evaluación pendiente, una puntuación ordinaria y un rubro no presentado. Un jurado no puede confirmar ni una autoridad administrativa puede cerrar una planilla que contenga ítems pendientes.

## Modelo de evaluación

`ballot_score.status` conserva únicamente la mutabilidad técnica: `DRAFT` o `LOCKED`.

Cada score incorpora un estado semántico explícito e independiente:

| Estado | Score almacenado | Significado |
|---|---:|---|
| `PENDING` | `NULL` | El jurado todavía no resolvió el ítem. Bloquea confirmar y cerrar. |
| `SCORED` | 1 a 10 | Puntuación ordinaria válida del jurado. |
| `NOT_PRESENTED` | 0 | El rubro o figura no se presentó en esa noche. No es una puntuación ordinaria ni un pendiente. |

El valor `0` nunca representa pendiente, error, falta de sincronización ni olvido del jurado.

## Alcance

Incluye:

- Estado semántico persistido y validado en PostgreSQL para cada score.
- Escala ordinaria exclusiva de 1 a 10.
- Acción separada `No se presentó`, que registra `NOT_PRESENTED` y score efectivo 0.
- Confirmación y cierre que rechazan todo `PENDING`.
- Auditoría sin valores de puntuación para cambios de estado de evaluación.
- Adaptación de API, UI del jurado, pruebas, documentación y datos históricos.

Excluye:

- Offline/sync, resultados, penalizaciones y actas.
- Cálculo de subsanaciones para nuevas planillas.
- Una UI o procedimiento nuevo de escrutinio.
- El `5 por equidad`, incluidos flujos, rutas, migraciones, cálculos y ajustes automáticos.

## Compatibilidad histórica

Los registros bloqueados de subsanación (`requires_subsanation` y `ballot_score_subsanation`) se conservan inalterados por trazabilidad. La migración 047 normaliza solo borradores heredados que aún eran editables a `PENDING`, para que el jurado los resuelva con el flujo nuevo. No se crean subsanaciones nuevas desde este flujo. Las rutas operativas de omisión y subsanación se retiran; el procedimiento reglamentario de escrutinio se especificará en su propio incremento.

## Requisitos funcionales

- **RF-57.** CADA score DEBE persistir exactamente uno de los estados `PENDING`, `SCORED` o `NOT_PRESENTED`, separado de su estado técnico `DRAFT` o `LOCKED`.
- **RF-58.** `PENDING` DEBE almacenar score `NULL`; `SCORED` DEBE almacenar un entero de 1 a 10; `NOT_PRESENTED` DEBE almacenar score 0. La base de datos DEBE impedir cualquier combinación distinta.
- **RF-59.** LA interfaz del jurado DEBE ofrecer únicamente 1 a 10 como puntuación ordinaria. `0` NO DEBE aparecer dentro de esa escala.
- **RF-60.** LA interfaz del jurado DEBE ofrecer una acción independiente `No se presentó` que registre `NOT_PRESENTED` para el ítem seleccionado.
- **RF-61.** CUANDO un jurado o ADMIN intente confirmar o cerrar una planilla con al menos un score `PENDING`, EL SISTEMA DEBE rechazar la operación. Para el cierre administrativo, DEBE identificar cada ítem pendiente junto con su jurado y comparsa.
- **RF-62.** EL JURADO DEBE poder volver un score editable a `PENDING` antes de confirmar mediante una acción explícita de quitar la decisión; no debe usar 0 ni una opción vacía como sustituto semántico.
- **RF-63.** CUANDO un score cambie entre `PENDING`, `SCORED` y `NOT_PRESENTED`, EL SISTEMA DEBE auditar la acción, actor y score afectado sin almacenar el valor de la puntuación en la auditoría.
- **RF-64.** UNA planilla confirmada o score `LOCKED` DEBE conservar su estado y score semánticamente consistentes e inmutables. Spec 006 no permite nuevas reaperturas; solo se admite finalizar registros históricos ya `REOPENED`.
- **RF-65.** EL SISTEMA DEBE conservar los registros históricos de subsanación sin permitir que una nueva planilla use la marca de omisión pre-confirmación.
- **RF-66.** CUANDO un jurado pulse `Confirmar planilla` y su planilla cargada contenga scores `PENDING`, LA interfaz DEBE abrir un diálogo modal bloqueante que enumere cada pendiente con comparsa, rubro e ítem, sin enviar la confirmación. El diálogo DEBE tener título y descripción accesibles, foco inicial dentro del diálogo, cierre explícito y con `Escape`, y devolver el foco al botón disparador. DEBE permanecer operativo en móvil, tablet y desktop, con lista desplazable cuando sea necesario.

## Contrato HTTP

- `PUT /api/v1/judge/ballots/:ballotId/scores/:scoreId` recibe `{ "evaluationState": "SCORED", "score": 1..10 }`, `{ "evaluationState": "NOT_PRESENTED" }` o `{ "evaluationState": "PENDING" }`.
- La respuesta expone `evaluationState` y `score`.
- El servidor no acepta `score: 0` como puntuación ordinaria ni `score: null` sin `evaluationState: "PENDING"`.
- Se retiran las rutas `/api/v1/scrutiny/ballots/:ballotId/scores/:scoreId/omissions` y `/api/v1/scrutiny/ballots/:ballotId/scores/:scoreId/subsanations`.

## Criterios de aceptación

- Una planilla recién abierta muestra todos los ítems en `PENDING`.
- Un jurado puede guardar 1 a 10 como `SCORED` y marcar independientemente `NOT_PRESENTED`.
- La UI no muestra 0 dentro de la escala ordinaria.
- Todo `PENDING` bloquea confirmación y cierre, con los ítems identificados.
- El intento del jurado de confirmar con pendientes abre un diálogo modal accesible que lista todos los pendientes; no envía la confirmación hasta que el jurado los resuelva.
- PostgreSQL rechaza combinaciones estado/score inválidas y mutaciones de scores bloqueados.
- Los registros de subsanación ya existentes permanecen intactos y no hay ruta nueva que cree omisiones pre-confirmación.
- Las pruebas DB, API y cliente cubren los tres estados y regresiones de confirmación, cierre, auditoría e inmutabilidad.
