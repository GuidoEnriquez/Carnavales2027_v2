# Constitución — Carnavales2027_v2

## Propósito

Construir una plataforma de gestión y votación para Carnavales 2027 mediante un proceso Spec-Driven Development (SDD): requisitos trazables antes que implementación.

## Principios

1. **Spec antes que código.** Cada capacidad nueva debe tener requisitos funcionales identificables, criterios de aceptación y alcance explícito antes de implementar.
2. **Arquitectura simple y modular.** API, cliente y persistencia se separan por responsabilidades. No se agregan capas, dependencias o patrones sin una necesidad comprobable.
3. **Seguridad por defecto.** Autenticación, autorización de mínimo privilegio, validación de entradas y protección de datos sensibles son requisitos de diseño, no agregados posteriores.
4. **Datos evolutivos y trazables.** PostgreSQL usa migraciones incrementales, reproducibles y no destructivas. Las acciones sensibles deben ser auditables.
5. **Reglas críticas verificadas.** Reglas de negocio, permisos, votación, confirmaciones, cálculos y sincronización deben contar con pruebas o verificaciones automatizables.
6. **Offline/sync idempotente cuando la spec lo exija.** Las operaciones que puedan reintentarse deben poder procesarse sin duplicar efectos y resolver conflictos de manera explícita.
7. **Cambios pequeños y revisables.** Las tareas se implementan en unidades acotadas, con commits claros. No hay push, merge, despliegue ni operaciones destructivas sin autorización explícita.

## Flujo obligatorio

```text
Constitución → Spec → Clarificación → Plan → Tareas →
Implementación → Validación
```

Un cambio de alcance actualiza primero la spec y sus artefactos derivados antes de modificar código.
