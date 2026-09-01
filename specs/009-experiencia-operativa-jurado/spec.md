# Spec 009 - Experiencia operativa del jurado

## Estado

- **Fase SDD:** Aprobada para implementación el 2026-09-01 por decisión del responsable de producto.
- **Fuente:** brief de diseño de producto del 2026-09-01 y referencias visuales de login, asignación, votación, revisión y home aportadas por el responsable de producto el 2026-09-01, registradas en `client/AGENTS.md`.
- **Relación:** rediseña la presentación del cliente sin alterar autorización, API, persistencia ni invariantes de Specs 004, 006, 007 y 008.

## Objetivo

Reducir la carga cognitiva de la operación del jurado durante noches de competencia mediante una interfaz oscura, táctil, responsive y explícita sobre progreso, conectividad, pendientes e inmutabilidad.

## Alcance

Incluye:

- Sistema visual oscuro institucional para el cliente React/Vite.
- Login de jurado claro y sin elementos administrativos innecesarios.
- Home del jurado con progreso, estado y acceso a cada planilla.
- Planilla con jerarquía visual para comparsa, rubro, ítem, estado de decisión, progreso y conectividad.
- Presentación diferenciada de `PENDING`, `SCORED`, `NOT_PRESENTED` y planilla confirmada.
- Controles de puntaje táctiles de al menos 48px, modales críticos y representación de lectura para ítems bloqueados.
- Adaptación para 390x844, 768x1024 y 1440x900.
- Lenguaje visual operativo de la referencia aprobada: fondo azul noche con trama sutil, superficies azul pizarra, acento azul lavanda y etiquetas monoespaciadas de alto contraste.

Excluye:

- Cambios a rutas, contratos API, roles, 2FA, asignaciones, persistencia o auditoría.
- Activación, modificación o aceptación operativa de Offline-First o sincronización. Los indicadores existentes se presentan como estado de conexión y cola local exploratoria, sin ampliar su comportamiento.
- Cierre de participación de jurado, resultados, rankings, desempate, escrutinio, actas y penalizaciones.
- Volver editable una decisión `SCORED` o `NOT_PRESENTED` confirmada.

## Requisitos funcionales

- **RF-80.** El cliente DEBE usar por defecto una paleta oscura de alto contraste, con texto e iconografía además de color para comunicar estados.
- **RF-81.** El login DEBE identificar el sistema y el segundo factor sin introducir controles administrativos ajenos a la autenticación.
- **RF-82.** El home del jurado DEBE derivar una card por comparsa programada desde las planillas propias, con comparsa, noche, especialidad, estado y progreso de ítems resueltos sobre el total. No implica un contrato API de planilla independiente por comparsa.
- **RF-83.** La planilla DEBE mantener visibles comparsa, especialidad, progreso y estado de conexión mientras el jurado decide.
- **RF-84.** La escala ordinaria DEBE exponer solo 1 a 10 mediante controles táctiles grandes; `No se presentó` DEBE ser una acción separada con advertencia explícita.
- **RF-85.** Un ítem `PENDING`, `SCORED` o `NOT_PRESENTED` DEBE tener representación visual y textual distinguible. Las decisiones confirmadas DEBEN aparecer como lectura bloqueada, sin controles aparentes de edición.
- **RF-86.** Los diálogos de confirmación, pendientes y cierre DEBEN conservar sus contratos de foco, Escape, retorno de foco y prevención de error táctil.
- **RF-87.** Las acciones críticas DEBEN ser operables sin hover ni precisión de mouse en móvil, tablet y escritorio.
- **RF-88.** Login, home y planilla DEBEN adoptar la jerarquía y el lenguaje visual de la referencia aprobada: identidad institucional compacta, etiquetas monoespaciadas, superficies oscuras delimitadas, acento azul lavanda y controles de puntuación amplios. La adaptación NO DEBE introducir edición de decisiones confirmadas ni capacidades nuevas.

## Criterios de aceptación

- El cliente mantiene la API y los flujos existentes, incluidas las respuestas `SCORE_IMMUTABLE`, `BALLOT_INCOMPLETE` y los estados de sesión.
- Las pruebas existentes de login, home, planilla, pendientes e inmutabilidad siguen pasando.
- Pruebas de cliente verifican el nuevo progreso, estados y representación bloqueada.
- El build de producción termina correctamente.
- La interfaz se revisa manualmente en 390x844, 768x1024 y 1440x900, con teclado y emulación táctil.
- La referencia visual se aplica sin incorporar los controles incompatibles con Specs 004 y 007.
