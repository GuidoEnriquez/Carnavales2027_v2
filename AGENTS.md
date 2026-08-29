# AGENTS.md — Carnavales2027_v2

## Propósito

Carnavales2027_v2 es una plataforma configurable de gestión y votación de Carnavales. Goya 2027 es una configuración inicial; no convertir sus cantidades, especialidades, categorías o rubros en constantes globales.

## Fuente de verdad y flujo SDD

Antes de modificar código, leer en este orden:

1. `docs/constitution.md`
2. `docs/source-map.md`
3. `specs/001-plataforma-votacion-carnavales/spec.md`
4. `specs/001-plataforma-votacion-carnavales/clarifications.md`
5. `specs/001-plataforma-votacion-carnavales/tasks.md`

El flujo obligatorio es:

```text
Constitución → Spec → Clarificación → Plan → Tareas → Implementación → Validación
```

Si cambia un requisito, actualizar primero la spec y sus artefactos derivados. No implementar desde una conversación aislada ni inferir reglas reglamentarias no documentadas.

## Reglas de ingeniería

- Mantener `api/` y `client/` separados por responsabilidad.
- Preferir cambios pequeños, trazables y revisables.
- Usar PostgreSQL con migraciones incrementales, reproducibles y no destructivas.
- No modificar el esquema interno de Better Auth; identidad/sesión y roles de aplicación se mantienen separados.
- La autorización se valida en API/servidor; las guardas de UI no son controles de seguridad.
- Toda regla crítica de dominio necesita test o verificación automatizable.
- No guardar secretos, tokens, contraseñas ni URLs con credenciales en Git, logs o documentación.

## Seguridad y operaciones prohibidas sin autorización

- No hacer push, merge, deploy ni cambios de producción.
- No ejecutar borrados destructivos de base de datos, esquemas, tablas ni migraciones irreversibles.
- No crear autoasignación pública del rol ADMIN.
- Exigir 2FA/OTP verificado para toda ruta protegida; una sesión primaria no basta.
- No eliminar ni degradar al último ADMIN activo.
- No implementar votación, nominaciones operativas, sorteo, offline, escrutinio ni actas mientras I1 no las incluya explícitamente.

## Dominio I1 acordado

I1 incluye configuración administrativa de eventos, noches, categorías por evento, comparsas participantes, especialidades, rubros e ítems evaluables; además prepara el modelo de nominaciones y programación por noche sin UI ni lógica operativa.

Reglas clave:

- Evento editable solo en `CONFIGURING`; bloqueado al pasar a `OPEN`.
- Categorías son catálogo scoped por evento, no texto libre.
- Una participación pertenece a una categoría del mismo evento.
- Rubro → especialidades se deriva desde ítems activos; no crear `rubro_especialidad`.
- Un ítem pertenece a un rubro y tiene una especialidad responsable.
- Abrir un evento exige configuración completa según `spec.md`.

## Verificación y reporte

Antes de cerrar una tarea:

1. Ejecutar su test específico y luego la suite aplicable.
2. Ejecutar migración/build/lint que aplique.
3. Revisar el diff.
4. Reportar archivos modificados y salida real de verificación.

No declarar una tarea terminada si falta evidencia real.
