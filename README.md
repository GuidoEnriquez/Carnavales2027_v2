# Carnavales2027_v2

Plataforma configurable de administración y votación para Carnavales. Goya 2027 es la configuración inicial de referencia, no una restricción del producto.

## Seguridad de cliente

Las rutas y guardas del cliente solo orientan la UX. La autorización real —sesión, 2FA y rol `ADMIN`— se verifica exclusivamente en la API antes de exponer o modificar datos.

## Estado

El proyecto sigue **Spec-Driven Development (SDD)**. El primer incremento implementará la configuración administrativa de eventos, noches, categorías, comparsas, especialidades, rubros e ítems evaluables.

## Documentación de trabajo

- [Constitución](docs/constitution.md)
- [Mapa de fuentes](docs/source-map.md)
- [Spec 001](specs/001-plataforma-votacion-carnavales/spec.md)
- [Clarificaciones](specs/001-plataforma-votacion-carnavales/clarifications.md)
- [Tareas](specs/001-plataforma-votacion-carnavales/tasks.md)
- [Plan aprobado](.hermes/plans/2026-08-29_091941-i1-configuracion-operativa.md)

## Estructura

```text
api/       # API y persistencia PostgreSQL
client/    # Panel administrativo React
```

## Seguridad

- No commitear `.env` ni secretos.
- No se permite autoasignación pública de `ADMIN`.
- No hay push, merge, deploy ni cambios destructivos sin autorización explícita.

La configuración y los comandos de ejecución se documentarán cuando se inicialicen `api/` y `client/`.
