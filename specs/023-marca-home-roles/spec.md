# Spec 023 — Capa de Marca y Home por Rol

## Estado

- **Fase SDD:** Especificación aprobada para desarrollo (Fase 5 del Plan Maestro).
- **Fuente:** `PLAN-maestro.md` §2.1, §2.4 y Fase 5; `PLAN-role-ux.md` Fases 1 a 6; Specs 016, 020, 021, 022.
- **Relación:** Consolida la identidad visual carnavalera ("el carnaval es la marca, la planilla es el instrumento") mediante la capa de marca sobre el sistema de diseño tokenizado (Spec 020), organiza el hub inicial de navegación por rol (`HomePage.jsx`), estandariza la redirección unificada post-login para todos los roles auxiliares y dota a la página de escrutinio de condiciones legibles de liberación (RF-94a).
- **Estado del working tree 2026-09-10:** `[NECESITA ACLARACIÓN]` La implementación actual elimina el hub `HomePage.jsx`/`#/home` y redirige ADMIN y roles auxiliares a estaciones operativas directas. Esta divergencia no cambia la regla aprobada en este documento hasta contar con una decisión de producto.

---

## Objetivo

Implementar la identidad visual del Carnaval de Goya ("Capa de Marca") en las pantallas institucionales y ceremoniales (Login, Home por rol, Resultados liberados y Acta notarial), proveyendo una experiencia de aterrizaje y navegación sin fricción orientada al rol del usuario, con accesibilidad WCAG 2.2 AA y respeto de `prefers-reduced-motion`.

---

## Alcance

### Incluye:
1. **Capa Dual Marca / Instrumento en el Shell:**
   - Atributo semántico `data-layer="brand"` o `data-layer="instrument"` en el contenedor principal o página.
   - En `data-layer="brand"`: paleta de acentos festivos (dorado `--brand-gold`, magenta `--brand-magenta`, turquesa `--brand-cyan`), tipografía display con carácter editorial festivo, sutil gradiente/textura festiva y sombras celebratorias.
   - En `data-layer="instrument"`: sobriedad funcional de alta concentración, contraste estricto, fondos oscuros sin distracciones, donde el único color es el código de especialidad o el color de identidad de la comparsa.
2. **Rediseño Institucional de `LoginPage.jsx`:**
   - Presentación bajo capa de marca con hero "Carnavales Goya 2027", subtítulo claro de acceso unificado, badge de seguridad.
   - Formulario de credenciales con iconos y botón para mostrar/ocultar contraseña con feedback accesible.
   - Formulario OTP con campos de 6 dígitos numéricos, autopegado y autofoco.
   - Insignia de estado de conexión.
3. **Hub por Rol (`HomePage.jsx`) con Guía Operativa:**
   - Tarjetas grandes organizadas por área de responsabilidad con iconos/pills de rol.
   - Explicación concisa en cada tarjeta ("qué hacés acá").
   - Enlace directo a la acción principal del rol.
   - Mensaje amigable ante usuarios sin rol asignado.
4. **Redirección Inteligente Unificada Post-Login (`goToRoleHome`):**
   - Si el usuario tiene un único rol activo, redirigir directamente a su estación de trabajo:
     - `ADMIN` → `#/admin/events`
     - `JUDGE` → `#/judge`
     - `COMISARIO` → `#/admin/penalties`
     - `SCRUTINEER` / `ESCRIBANO` → `#/admin/results`
     - `VEEDOR` → `#/veedor`
   - Si el usuario tiene múltiples roles (o ninguno), redirigir a `#/home` para elegir el área de trabajo.
5. **Panel Guiado de Escrutinio en `AdminResultsPage.jsx`:**
   - Stepper de 4 pasos con estados claros (`Listo`, `En curso`, `Bloqueado`, `No requerido`).
   - Panel de "Condiciones previas para liberar resultados" que describe en lenguaje accesible los requisitos de RF-94a:
     - Votación de jornadas cerrada.
     - Todas las planillas en `SUBMITTED` o `REPLACED`.
     - Cero ítems en `PENDING`.
     - Exclusividad de liberación para `SCRUTINEER` y `ESCRIBANO`.
6. **Accesibilidad y Respeto a Preferencias del Usuario:**
   - Contraste AA verificado (mínimo 4.5:1 para texto normal, 3:1 para controles y gráficos).
   - Directiva `@media (prefers-reduced-motion: reduce)` que inhibe rotaciones, animaciones continuas o transiciones bruscas.

### Excluye:
- Alterar la lógica transaccional de resultados, penalizaciones o actas.
- Modificar las firmas hológrafas o la estructura notarial del acta oficial (Spec 015).
- Portal público de resultados (diferido a Spec 024).

---

## Requisitos Funcionales

- **RF-200 — Capa de Marca vs Instrumento:**
  El frontend aplicará el atributo de capa (`data-layer="brand"` en Login, Home, Resultados y Acta; `data-layer="instrument"` en Planilla, Asignaciones, Comisariato y Supervisión) alternando la escala tipográfica, acentos festivos y texturas sin romper los tamaños mínimos táctiles ni el contraste accesible.
- **RF-201 — Pantalla de Acceso con Identidad Carnaval:**
  `LoginPage.jsx` presentará el hero institucional carnavalero con marca Goya 2027, soporte de visualización de contraseña accesible, verificación OTP fluida de 6 dígitos e indicador discreto de conexión.
- **RF-202 — Home Consciente del Rol con Próximo Paso Sugerido:**
  `HomePage.jsx` organizará las áreas habilitadas según los roles de la sesión activa (`ADMIN`, `JUDGE`, `COMISARIO`, `SCRUTINEER`, `ESCRIBANO`, `VEEDOR`), describiendo el propósito de cada una y brindando el enlace de acceso directo.
- **RF-203 — Enrutamiento y Redirección Inteligente Post-Login:**
  La función de aterrizaje dirigirá al usuario mono-rol directamente a su pantalla operativa correspondiente y al usuario multi-rol a `#/home`.
- **RF-204 — Stepper Guiado y Condiciones de Escrutinio:**
  `AdminResultsPage.jsx` expondrá un stepper visual y un panel de requisitos previos de liberación conforme a RF-94a, explicando por qué los resultados están listos o qué falta para habilitar la liberación.
- **RF-205 — Accesibilidad Universal y Reducción de Movimiento:**
  Todo elemento visual cumplirá con contraste mínimo WCAG 2.2 AA (4.5:1) y responderá a la preferencia del sistema `prefers-reduced-motion: reduce` suprimiendo animaciones y transiciones no esenciales.

---

## Criterios de Aceptación

1. La capa de marca (`data-layer="brand"`) está activa en `LoginPage.jsx` y `HomePage.jsx` y aplica la identidad con acentos festivos.
2. `LoginPage.jsx` permite autenticación con usuario/contraseña, alternancia de visibilidad de contraseña, y código OTP de 6 dígitos.
3. `HomePage.jsx` muestra solo las tarjetas correspondientes a los roles del usuario autenticado y contiene enlaces directos funcionales.
4. El post-login redirige automáticamente según el rol (`ADMIN` a `/admin/events`, `JUDGE` a `/judge`, `COMISARIO` a `/admin/penalties`, `SCRUTINEER`/`ESCRIBANO` a `/admin/results`, `VEEDOR` a `/veedor`, multi-rol a `/home`).
5. `AdminResultsPage.jsx` presenta el stepper de 4 pasos y la explicación legible de las condiciones de liberación.
6. Se aplican estilos `@media (prefers-reduced-motion: reduce)` en componentes y fondos animados.
7. Todas las pruebas automatizadas de cliente y backend pasan al 100%.
