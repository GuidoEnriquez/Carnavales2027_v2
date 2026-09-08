# Spec 020 — Fundación del Sistema de Diseño

## Estado

- **Fase SDD:** Especificación aprobada para desarrollo (Fase 2 del Plan Maestro).
- **Fuente:** `PLAN-maestro.md` §2.1, §2.3 y Fase 2; `docs/constitution.md` (Principio 8: Operación inclusiva en campo); Spec 009.
- **Relación:** Establece la base de tokens, capas visuales, accesibilidad y componentes atómicos compartidos sin alterar las reglas de negocio, persistencia, contratos de API ni invariantes existentes. Habilita el rediseño de la planilla v3 (Spec 021) y el tiempo real (Spec 022).

---

## Objetivo

Unificar y ordenar la arquitectura de interfaz de usuario de Carnavales2027_v2 sobre un único sistema de tokens semánticos, eliminando estilos monolíticos y reglas obsoletas, separando la identidad festiva de la sobriedad operativa mediante capas visuales (`data-layer="brand" | "instrument"`), proveyendo componentes atómicos reutilizables plenamente accesibles (WCAG 2.2 AA) y completando la especificación PWA.

---

## Alcance

### Incluye:
1. **Tokens semánticos (`client/src/styles/tokens.css`):**
   - Color semántico: superficies (`--surface-base`, `--surface-card`, `--surface-raised`, `--surface-overlay`), textos (`--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`), acentos (`--accent-primary`, `--accent-hover`, `--accent-subtle`), estados (`--success`, `--warning`, `--danger`, `--info`), y bordes (`--border-subtle`, `--border-strong`).
   - Escala tipográfica: `--font-sans` (Inter/sistema), `--font-display` (titulares festivos), tamaños fluidos `--text-xs` a `--text-3xl`.
   - Espaciado y radios: escala de 4px (`--space-1` a `--space-12`), radios `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-full` (9999px).
   - Dimensiones táctiles y foco: `--touch-target-min: 48px`, `--touch-target-lg: 56px`, `--focus-ring-width: 3px`.
   - Soporte nativo para `prefers-reduced-motion` y `prefers-contrast`.
2. **Capa visual dual (`data-layer`):**
   - `data-layer="brand"`: identidad visual festiva para pantallas públicas e institucionales (login, selección de roles, bienvenida, resultados liberados, portal). Acentos carnavaleros (magenta `#E11D74`, dorado `#F5B301`, turquesa `#14B8A6`), tipografía display.
   - `data-layer="instrument"`: sobriedad y máxima concentración para pantallas operativas (planilla de jurado, panel de administración, monitor VEEDOR, comisariato de penalizaciones, escrutinio). Fondo oscuro neutro `#090D16`, alto contraste, sin distracciones ni animaciones decorativas.
3. **Componentes compartidos atómicos y accesibles:**
   - `<Dialog>`: modal nativo HTML5 con focus trapping, retorno automático de foco (`focusReturnRef`), soporte de tecla Escape, `aria-labelledby`, `aria-describedby` y backdrop estilizado.
   - `<Button>`: botón accesible con variantes (`primary`, `secondary`, `danger`, `ghost`), estados de carga (`busy`/`loading`) con `aria-busy` y target táctil ≥ 48px.
   - `<StatusPill>`: badge semántico de estado operativo con contraste accesible.
   - `<ProgressBar>`: barra de progreso accesible con roles ARIA (`role="progressbar"`).
   - `<Toast>`: sistema de avisos y notificaciones en pantalla no intrusivo (`role="status"`, `aria-live="polite"`).
4. **Consolidación de infraestructura frontend:**
   - Guard de roles unificado `<RequireAnyRole allowedRoles={[...]} />` manteniendo retrocompatibilidad total con los guards existentes.
   - Centralización de rutas por rol en `client/src/auth/role-routes.js`.
   - Diccionario centralizado de errores y textos para el usuario en `client/src/i18n/errors.js`.
5. **PWA y accesibilidad estructural:**
   - Registro de iconos en `manifest.webmanifest`, `theme_color` `#090D16`, `background_color` `#090D16`.
   - Actualización de `index.html` con meta theme-color, skip-link a `<main id="main-content">` y títulos accesibles.

### Excluye:
- Modificaciones al backend, base de datos, migraciones o rutas de la API.
- Cambios a la lógica de negocio de votación, resultados, penalizaciones o actas.
- Rediseño integral de la pantalla del jurado (reservado para Spec 021).
- Activación de persistencia local offline (reservado para Spec futura si se aprueba).

---

## Requisitos Funcionales

- **RF-176 — Sistema Unificado de Tokens Semánticos (`tokens.css`):**
  La aplicación DEBE definir todos sus valores de diseño como variables CSS semánticas en `client/src/styles/tokens.css`. Se prohíbe el uso de colores fijos no tokenizados en componentes nuevos. Se DEBE eliminar el `:root` claro arcaico y unificar sobre el esquema base oscuro (`#090D16`). DEBE garantizarse soporte para `prefers-reduced-motion: reduce` (duraciones de animación forzadas a 0.01ms) y `prefers-contrast: more` (bordes reforzados y contraste incrementado).
- **RF-177 — Capa Dual Marca vs Instrumento (`data-layer="brand" | "instrument"`):**
  El shell o layout principal DEBE permitir configurar el atributo `data-layer`.
  - En `data-layer="brand"`, la UI DEBE aplicar acentos festivos (magenta, dorado, turquesa) y tipografía display en títulos.
  - En `data-layer="instrument"`, la UI DEBE restringir los acentos a las especialidades y comparsas, aplicando fondos oscuros de alta absorción, contraste WCAG 2.2 AA (mínimo 4.5:1 para texto normal y 3:1 para controles) y ausencia de animaciones decorativas.
- **RF-178 — Componentes Compartidos Accesibles Atómicos:**
  La aplicación DEBE proveer en `client/src/components/` los componentes atómicos:
  1. `<Dialog>`: modal basado en el elemento `<dialog>` nativo, con soporte obligatorio de foco atrapado, retorno de foco al disparador al cerrarse (`focusReturnRef`), cierre por tecla ESC, `aria-labelledby`, `aria-describedby` y backdrop.
  2. `<Button>`: botón accesible con target táctil mínimo de 48px, variantes semánticas y feedback de estado ocupado (`busy`) con `aria-busy="true"`.
  3. `<StatusPill>`: indicador visual de estado con texto legible y contraste garantizado.
  4. `<ProgressBar>`: barra con atributos `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.
  5. `<Toast>`: contenedor accesible con `role="status"` y `aria-live="polite"`.
- **RF-179 — Consolidación de Guardas de Rol (`RequireAnyRole`) y Enrutamiento (`role-routes.js`):**
  La aplicación DEBE implementar `<RequireAnyRole allowedRoles={[...]} />` en `client/src/auth/RequireAnyRole.jsx`. Las guardas preexistentes (`RequireAdmin`, `RequireRole`, `RequireResultsRole`, `RequirePenaltiesRole`, `RequireVotingObserverRole`) DEBEN reutilizar esta implementación sin alterar sus contratos ni firmas públicas. Se DEBE centralizar la asociación de roles y sus rutas por defecto en `client/src/auth/role-routes.js`.
- **RF-180 — Diccionario Centralizado de Mensajes y Errores (`i18n/errors.js`):**
  La aplicación DEBE disponer de un módulo `client/src/i18n/errors.js` que reciba códigos de error devueltos por el backend (p. ej. `BALLOT_IMMUTABLE`, `BALLOT_INCOMPLETE`, `INVALID_CREDENTIALS`, `TWO_FACTOR_REQUIRED`, `NETWORK_ERROR`, `SYNC_OPERATION_MISMATCH`, `RATE_LIMIT_EXCEEDED`, `PAYLOAD_TOO_LARGE`) y retorne mensajes en lenguaje claro, empático y orientado a la acción del usuario, evitando terminología técnica o códigos crudos en pantalla.
- **RF-181 — Especificación y Metadatos PWA Completos:**
  El archivo `client/public/manifest.webmanifest` DEBE incorporar la colección de `"icons"` (mínimo 192x192, 512x512 y formatos SVG/maskable), y alinear `theme_color` y `background_color` al azul noche `#090D16`. El documento `client/index.html` DEBE contar con `meta name="theme-color" content="#090D16"`, `apple-touch-icon` y un skip-link accesible `<a href="#main-content" class="skip-link">` que salte directamente al contenido principal de la página.

---

## Criterios de Aceptación

1. Todos los tokens semánticos están documentados y disponibles globalmente vía `tokens.css`.
2. El contenedor principal soporta `data-layer="brand"` y `data-layer="instrument"` adaptando acentos y tipografía sin degradar contraste.
3. El componente `<Dialog>` atrapa el foco, se cierra con Escape o click en backdrop, y retorna el foco al elemento invocador.
4. El componente `<Button>` tiene una altura mínima de 48px en dispositivos táctiles y gestiona el estado `busy`.
5. `<RequireAnyRole>` reemplaza la duplicación en los 5 guards existentes, pasando el 100% de los tests unitarios existentes.
6. `manifest.webmanifest` contiene iconos válidos y los metadatos PWA son sintácticamente correctos.
7. La suite completa de tests de cliente (138 tests) se mantiene pasando al 100%, más los tests nuevos que cubren los RFs de la presente spec.
8. `npm run build` en `client/` compila sin advertencias ni errores.
