# Validación — Spec 020: Fundación del Sistema de Diseño

## Estado de Validación

- **Fecha:** 2026-09-08
- **Alcance evaluado:** T01 a T06 de Spec 020.
- **Resultado General:** EXITOSA (100% pruebas aprobadas).

## Matriz de Cobertura de Requisitos

| Requisito | Descripción | Estado | Evidencia |
|---|---|---|---|
| RF-176 | Sistema de tokens semánticos (`tokens.css`), escalas y media queries accesibles | Validado | `client/src/styles/tokens.css`, `client/src/tests/tokens.test.js` |
| RF-177 | Capa visual dual Marca vs Instrumento (`data-layer="brand" \| "instrument"`) | Validado | `client/src/App.jsx`, `client/src/tests/tokens.test.js` |
| RF-178 | Componentes compartidos atómicos (`Dialog`, `Button`, `StatusPill`, `ProgressBar`, `Toast`) | Validado | `client/src/components/*`, `client/src/tests/components.test.jsx` |
| RF-179 | Consolidación de guardas de rol (`RequireAnyRole`) y enrutamiento centralizado | Validado | `client/src/auth/RequireAnyRole.jsx`, `client/src/auth/role-routes.js`, `client/src/tests/RequireAnyRole.test.jsx` |
| RF-180 | Diccionario de errores y mensajes en lenguaje de usuario (`i18n/errors.js`) | Validado | `client/src/i18n/errors.js`, `client/src/tests/errors.test.js` |
| RF-181 | PWA completa (iconos, theme-color, manifest válido) y skip-link accesible | Validado | `client/public/manifest.webmanifest`, `client/index.html`, `client/src/tests/pwa-metadata.test.js` |

## Registro de Pruebas Automatizadas

### 1. Tests de Cliente (`npm test` en `client/`)
```
Test Files  36 passed (36)
     Tests  168 passed (168)
  Duration  5.66s
```
- 138 tests preexistentes pasaron sin ninguna alteración ni regresión.
- 30 tests nuevos cubrieron al 100% tokens, componentes atómicos, guardas consolidadas, i18n de errores y PWA.

### 2. Build de Producción (`npm run build` en `client/`)
```
✓ 63 modules transformed.
dist/index.html                   0.82 kB │ gzip:  0.44 kB
dist/assets/index-CiD9HJd2.css   70.96 kB │ gzip: 13.59 kB
dist/assets/index-CUjpHUx5.js   349.29 kB │ gzip: 96.91 kB
✓ built in 806ms
```

### 3. Verificación de Suites Globales (API y BD)
- `npm test` en `api/`: 134/134 tests aprobados.
- `npm run db:test` en `api/`: 68/68 tests aprobados.

## Verificación de Integridad

- Retrocompatibilidad absoluta: los alias de variables CSS anteriores aseguran que ninguna pantalla previa se vea afectada visualmente de forma negativa.
- Accesibilidad: `<Dialog>` respeta focus trapping y retorno de foco con `focusReturnRef`; `<Button>` respeta `aria-busy` y target táctil ≥ 48px; `index.html` incluye skip-link para lectores de pantalla y teclado.
- PWA instalable: `manifest.webmanifest` con iconos vectoriales y rasterizados (192px y 512px maskable).
