# Plan técnico - Spec 009

1. Reemplazar los tokens globales y estilos base por el sistema oscuro, controles táctiles, foco visible y superficies de alto contraste.
2. Rediseñar `LoginPage` y `AppNavigation` sin cambiar autenticación, rutas ni cierre de sesión.
3. Derivar progreso por planilla desde los scores ya devueltos por la API y presentar cards operativas en `JudgeHomePage`.
4. Reorganizar `JudgeBallotPage` para jerarquizar comparsa, ítem, escala, estado de conexión, decisiones bloqueadas, pendientes y confirmaciones existentes.
5. Extender pruebas de cliente para progreso y representación bloqueada; ejecutar pruebas y build.
6. Aplicar la referencia visual aprobada a login, home y planilla, preservando la inmutabilidad y sin crear el paso de confirmación de asignación ni edición posterior.
