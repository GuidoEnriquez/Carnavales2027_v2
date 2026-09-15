# Plan — Spec 028, corrección del home (2026-09-15)

La implementación histórica está ratificada en spec/tasks/validation. Este
plan cubre la corrección pedida por producto (RF-HOME-01–04).

1. Derivar completitud visual por comparsa en `JudgeHomePage.jsx`. Excluir
   completas de AHORA/PRÓXIMAS e incluirlas en EVALUADAS, sin modificar
   `isTroupeLockedInSequence` ni la fuente `include=progress`/fallback.
2. Usar conteo de evaluadas y distinguir completitud de confirmación. Mostrar
   revisión por planilla completa no SUBMITTED usando la ruta existente.
3. Retirar la regla legacy de primer div y las dos columnas en la tarjeta de
   progreso; permitir wrap y separación de etiquetas solo en este panel.
4. Extender pruebas de home: captura reproducida, acción de consulta, revisión,
   pendientes próximos a 100%, planillas confirmadas y datos sin ítems.
5. Ejecutar focales home/planilla, suite cliente, build y diff. Registrar
   resultados reales y declarar pendiente visual si no hay navegador.
   Si el test de confirmación online avanza al submit antes de reflejar el
   último guardado, esperar el estado visible "Lista para revisar"; conservar
   las aserciones de API y cierre, sin cambiar lógica productiva de planilla.

Diseño: superficies y tipografía Instrumento existentes; una protagonista
para trabajo pendiente, listas compactas y progreso de ancho completo.
Móvil/tablet apilan el contenido; desktop conserva la distribución vigente.
No requiere migración, API ni dependencias nuevas.
