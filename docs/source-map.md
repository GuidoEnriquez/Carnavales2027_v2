# Mapa de fuentes — Carnavales2027_v2

> Estado: inventario inicial provisto por Guido. Pendiente: URLs o export/contenido verificable de Jira y Confluence antes de declarar requisitos como definitivos.

## Jira — proyecto SVC2

### Base y alcance

- `SVC2-1` — Epic PMV: Sistema de Votaciones Carnavales Goya 2027
- `SVC2-5` — Definir alcance y reglas funcionales
- `SVC2-30` — Modelo de datos: eventos, jurados, asignaciones y votación — finalizada
- `SVC2-49` — Definir tablas principales
- `SVC2-50` — Definir relaciones entre los datos
- `SVC2-51` — Controlar datos repetidos o incorrectos

### Jurados y acceso

- `SVC2-9` — Registrar e invitar jurados
- `SVC2-10` — Identificación y validación del jurado
- `SVC2-25` — Sesión de jurado por evento/noche
- `SVC2-59` — Jurados habilitados por noche
- `SVC2-60` — Cupo configurable de jurados
- `SVC2-61` — Reemplazo de jurado
- `SVC2-67` — Padrón e invitaciones configurables

### Votación, integridad y offline

- `SVC2-13` — Cargar puntuaciones por comparsa
- `SVC2-14` — Validar carga de puntuaciones
- `SVC2-26` — Máquina de estados e inmutabilidad de votos
- `SVC2-27` — Reglas de cierre y modificación
- `SVC2-28` — Auditoría, trazabilidad y cadena de integridad
- `SVC2-38` — Sincronización offline idempotente
- `SVC2-80` — Confirmar planilla de evaluación

### Resultados

- `SVC2-17` — Consolidar notas válidas
- `SVC2-19` — Regla oficial de desempate
- `SVC2-41` — Supervisar votaciones sin exponer puntajes

## Confluence — espacio C2

### Páginas

- Inicio del espacio Carnavales 2027
- Guía oficial del equipo y planificación
- Guía de incorporación y trabajo del equipo
- Sprint 1 — Guía operativa para tomar y gestionar Issues
- Ítems a votar por jurados

### Fuente principal

`Guía del equipo y planificación` concentra el baseline funcional: alcance, reglas de votación, escala, omisiones, cierre de planilla, flujos de jurados, asignación, acceso, offline-first, inmutabilidad, secreto, auditoría, penalizaciones, desempate, escrutinio, actas, roles y sprints.

### Fuente de rubros

`Ítems a votar por jurados` define rubros nominativos, aleatorios y resultados derivados.

### Procedimiento operativo

`Sprint 1 — Guía operativa para tomar y gestionar Issues` define acuerdos de trabajo y cierre de issues.

## Obsidian — referencias disponibles

El vault contiene copias/síntesis utilizables para redactar la spec. Jira y Confluence siguen siendo la fuente canónica cuando exista un conflicto o haya información más reciente.

- `20 - Proyectos/Carnavales 2027/Guia del equipo - Confluence.md`
  - Copia de la página de Confluence C2 `5013505`.
  - Define objetivo configurable y reutilizable, offline-first, secreto de voto, roles, jornadas, escala, omisiones, penalizaciones, desempate y escrutinio.
- `20 - Proyectos/Carnavales 2027/Backlog SVC2 - Resumen.md`
  - Resumen de Jira SVC2 al `2026-08-27`; útil para épicas, prioridades y trazabilidad, pero no para inferir estados actuales.
- `20 - Proyectos/Carnavales 2027/Areas/09 - Base de Datos - Modelo Completo.md`
  - Diseño de referencia para datos, concurrencia, idempotencia y cierres transaccionales.
- `20 - Proyectos/Carnavales 2027/Areas/11 - Registro e Invitacion de Jurados (SVC2-9).md`
  - Reglas y criterios de aceptación de padrón, invitaciones y habilitación de jurados.

## Uso en SDD

- La spec debe enlazar cada requisito a una fuente Jira/Confluence o a su copia identificada de Obsidian.
- Los títulos de tickets no se interpretan como reglas completas.
- Ante conflicto entre una copia de Obsidian y Jira/Confluence actual, se documenta como `[NECESITA ACLARACIÓN]` antes del plan o código.
