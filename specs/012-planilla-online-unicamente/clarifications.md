# Clarificaciones — Spec 012

- La retención temporal de `/sync` es una medida de transición para clientes antiguos, no una capacidad operativa nueva.
- El service worker puede conservar recursos estáticos y excluye la API; no habilita votación offline por sí mismo.
- La limpieza de datos locales heredados solo ocurre en logout, conforme al comportamiento existente. No se agrega borrado automático de operaciones pendientes.
