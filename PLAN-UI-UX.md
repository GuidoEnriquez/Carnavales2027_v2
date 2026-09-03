# Plan de Correcciones UI/UX — Carnavales2027_v2

> **Estado:** COMPLETADO el 2026-09-03. Todas las fases (1 a 5) fueron implementadas en `LoginPage.jsx`, `JudgeHomePage.jsx`, `JudgeBallotPage.jsx`, `AppNavigation.jsx` e `index.css`, y validadas con 98 tests de cliente pasando al 100% y Vite build exitoso.

## Prioridades (orden de ejecución)

1. Eliminar el mensaje "revisá la consola de la API"
2. Indicar dónde fue enviado el código y que tiene 6 números
3. Agregar mostrar contraseña
4. Unificar el indicador de conexión en toda la aplicación
5. Eliminar la contradicción "Comparsas habilitadas / Cerrada"
6. Mostrar claramente "Votación completada — no tenés pendientes" cuando llegue al 100%

---

## Fase 1: Pantalla de inicio de sesión

**Archivo:** `client/src/pages/LoginPage.jsx`

### 1.1 Botón mostrar/ocultar contraseña (Iconos SVG)

- Estado `showPassword` (boolean)
- Alterna `type={showPassword ? "text" : "password"}`
- Botón accesible con iconos SVG vectoriales (`EyeIcon` / `EyeOffIcon`) con `aria-label="Mostrar contraseña"` / `"Ocultar contraseña"`
- Estilo: botón integrado al final del input, centrado vertical, color suave con hover y outline accesible.

### 1.2 Indicador de conexión (Retirado)

- **Decisión de producto del 2026-09-03:** El indicador de conexión ("En Línea / Conectado / Sin conexión") fue retirado de `LoginPage.jsx`, `AppNavigation.jsx` y `JudgeBallotPage.jsx` por considerarse irrelevante y redundante en una arquitectura 100% online donde los fallos de red se gestionan reactivamente al momento del intento.

### 1.3 Corregir mensajes de error

| Línea | Actual | Nuevo |
|---|---|---|
| 34 | `"No se pudo iniciar sesión. Revisá el correo y la contraseña."` | `"Correo o contraseña incorrectos."` |
| 50 | `"La sesión se inició, pero no se pudo preparar el segundo factor. Intentá nuevamente."` | `"No pudimos iniciar sesión. Intentá nuevamente."` |

### 1.4 "¿Olvidaste tu contraseña?" (Retirado)

- **Decisión de producto del 2026-09-03:** Retirado para mantener la pantalla de login concisa y enfocada exclusivamente en credenciales y OTP.

---

## Fase 2: Pantalla de código de verificación (OTP)

**Archivo:** `client/src/pages/LoginPage.jsx` (bloque `step === "otp"`)

### 2.1 Header informativo

Encima del campo del código, agregar:

```
Verificá tu identidad
Te enviamos un código de 6 números a es••••@gmail.com
Ingresalo para continuar.
```

- Necesita pasar el email parcializado desde el estado del componente
- Función `maskEmail(email)`: mostrar primera letra + `••••@` + dominio

### 2.2 Rediseñar campo del código

Enfoque recomendado: 6 inputs individuales

```jsx
<input type="text" inputMode="numeric" pattern="[0-9]" maxLength="1" />
× 6
```

- Auto-advance al siguiente input al escribir dígito
- Auto-backspace al borrar
- Accept solo dígitos
- Estilo: 6 cuadros centrados con `letter-spacing` amplio

### 2.3 Reenviar código con countdown

- Estado `resendCooldown` (inicia en 28 segundos)
- `useEffect` con `setInterval` que decrementa cada segundo
- Mostrar: `¿No recibiste el código? Reenviar código en 28 s`
- Cuando `resendCooldown === 0`: `Reenviar código` (clicable)
- Botón deshabilitado mientras `resendCooldown > 0`

### 2.4 Eliminar mensaje de desarrollo

Línea 46-48:

```jsx
// ANTES:
setMessage(import.meta.env.DEV
  ? "Código enviado. En desarrollo, revisá la consola de la API."
  : "Código enviado al correo configurado.");

// DESPUÉS:
setMessage("✓ Código enviado correctamente");
```

### 2.5 Corregir mensajes de error OTP

| Línea | Actual | Nuevo |
|---|---|---|
| 78 | `"El código es inválido o venció."` | `"El código no es correcto."` |
| 89 | `"Enviamos un nuevo código."` | `"Te enviamos un nuevo código."` |
| 91 | `"No se pudo reenviar el código."` | `"No se pudo reenviar el código. Intentá nuevamente."` |

### 2.6 Validación de largo

- Si el código tiene menos de 6 dígitos: `"Ingresá los 6 números para continuar."`

---

## Fase 3: Pantalla principal del jurado

**Archivo:** `client/src/pages/JudgeHomePage.jsx`

### 3.1 Cambiar "Comparsas habilitadas"

- Línea 85: `"Comparsas habilitadas"` → `"Tus comparsas"`

### 3.2 Cambiar "ítems resueltos"

- Línea 78: `"ítems resueltos"` → `"puntuaciones completadas"`
- Ejemplo: `2 / 2 comparsas confirmadas · 5 / 5 puntuaciones completadas`

### 3.3 Cambiar badge "Cerrada"

- Línea 62: `getState()` para `SUBMITTED`
- Label `"Cerrada"` → `"Planilla confirmada"`

### 3.4 Mensaje de completado al 100%

Cuando `progress === 100`, mostrar en la tarjeta de progreso:

```jsx
<div className="judge-completion-message">
  <span className="completion-icon">✓</span>
  <div>
    <strong>Votación completada</strong>
    <p>Confirmaste las {troupes.length} comparsas asignadas.</p>
    <p>No tenés votaciones pendientes.</p>
  </div>
</div>
```

En lugar de solo `100%` y el conteo.

### 3.5 Texto "Planilla confirmada" con explicación

- Línea 91: `locked copy`
- `"Planilla confirmada"` → `"Planilla confirmada — No se puede modificar"`

---

## Fase 4: Pantalla de votación

**Archivo:** `client/src/pages/JudgeBallotPage.jsx`

### 4.1 Header de planilla confirmada

Cuando `readonly === true`, mostrar antes del workspace:

```jsx
<section className="readonly-notice">
  <span aria-hidden="true">🔒</span>
  <div>
    <strong>Planilla confirmada</strong>
    <p>Esta planilla es solo para consulta y ya no puede modificarse.</p>
  </div>
</section>
```

### 4.2 Unificar indicador de conexión

| Línea | Actual | Nuevo |
|---|---|---|
| 218 | `"Online"` / `"Offline"` | `"● EN LÍNEA"` / `"● SIN CONEXIÓN"` |
| 223 | `"● Con conexión"` / `"! Sin conexión"` | `"● EN LÍNEA"` / `"● SIN CONEXIÓN"` |

---

## Fase 5: Navbar global

**Archivo:** `client/src/components/AppNavigation.jsx`

### 5.1 Unificar indicador de conexión

- Línea 52: `"Online"` / `"Sin conexión"` → `"● EN LÍNEA"` / `"● SIN CONEXIÓN"`

---

## Fase 6: CSS global

**Archivo:** `client/src/index.css`

### 6.1 Toggle de contraseña

```css
.login-password-wrapper {
  position: relative;
}
.login-password-toggle {
  position: absolute;
  inset-inline-end: 0.75rem;
  inset-block-start: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.5rem;
}
.login-password-toggle:hover { color: #e2e8f0; }
```

### 6.2 Campo de código OTP (6 inputs)

```css
.otp-input-group {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}
.otp-input-group input {
  inline-size: 3rem;
  block-size: 3.5rem;
  text-align: center;
  font-size: 1.5rem;
  font-family: var(--mono-font);
  border: 2px solid rgba(148,163,184,.34);
  border-radius: 0.5rem;
  background: #304258;
  color: #f8fafc;
}
.otp-input-group input:focus {
  border-color: var(--primary-color);
  outline: none;
}
```

### 6.3 Header informativo OTP

```css
.otp-header {
  margin-block-end: 1.5rem;
  text-align: center;
}
.otp-header h2 {
  color: #f8fafc;
  font-size: 1.2rem;
  margin: 0 0 0.5rem;
}
.otp-header p {
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0.25rem 0;
}
.otp-header .otp-email {
  color: #e2e8f0;
  font-weight: 700;
}
```

### 6.4 Countdown de reenvío

```css
.resend-cooldown {
  color: #64748b;
  font-size: 0.85rem;
  margin-block-start: 0.5rem;
}
.resend-cooldown button:not(:disabled) {
  color: var(--primary-color);
  text-decoration: underline;
  cursor: pointer;
}
```

### 6.5 Mensaje de completado 100%

```css
.judge-completion-message {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(34,197,94,.35);
  border-radius: 0.75rem;
  background: rgba(20,83,45,.15);
}
.judge-completion-message .completion-icon {
  display: grid;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  place-items: center;
  border-radius: 50%;
  background: #86efac;
  color: #052e16;
  font-weight: 900;
  font-size: 1.2rem;
}
.judge-completion-message strong {
  color: #86efac;
  font-size: 1.1rem;
}
.judge-completion-message p {
  color: #bbf7d0;
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
}
```

### 6.6 Aviso de solo lectura (planilla confirmada)

```css
.readonly-notice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  margin-block-end: 1rem;
  border: 1px solid rgba(34,197,94,.35);
  border-radius: 0.75rem;
  background: rgba(20,83,45,.15);
  color: #bbf7d0;
}
.readonly-notice > span {
  display: grid;
  inline-size: 2rem;
  block-size: 2rem;
  place-items: center;
  font-size: 1.2rem;
}
.readonly-notice strong { color: #86efac; }
.readonly-notice p { margin: 0.2rem 0 0; font-size: 0.85rem; }
```

---

## Archivos a modificar

| Archivo | Cambios |
|---|---|
| `client/src/pages/LoginPage.jsx` | Toggle contraseña con iconos SVG, errores limpios, OTP header, 6 dígitos, countdown, remoción de olvidaste contraseña y estado de conexión |
| `client/src/pages/JudgeHomePage.jsx` | Textos: "Tus comparsas", "puntuaciones completadas", "Planilla confirmada", mensaje 100% |
| `client/src/pages/JudgeBallotPage.jsx` | Header planilla confirmada, remoción de widgets redundantes de conexión |
| `client/src/components/AppNavigation.jsx` | Remoción de badge de conexión para navegación limpia |
| `client/src/index.css` | Estilos: toggle contraseña, OTP 6 dígitos, countdown, header OTP, mensaje completado, readonly notice |
| `client/src/tests/LoginPage.test.jsx` | Actualizar assertions |
| `client/src/tests/JudgeHomePage.test.jsx` | Actualizar assertions |
| `client/src/tests/JudgeBallotPage.test.jsx` | Actualizar assertions |
| `client/src/tests/AppNavigation.test.jsx` | Actualizar assertions |

---

## Validación

```bash
# Tests
cd client && npm test

# Build
cd client && npm run build

# Verificación visual manual
# Chrome DevTools → Device Toolbar
# Viewports: 390×844, 768×1024, 1440×900
```

---

## Flujo esperado del usuario (post-correcciones)

```
Inicio de sesión
  → Correo
  → Contraseña 👁
  → Ingresar

Verificación
  → "Te enviamos un código de 6 números a es••••@gmail.com"
  → _ _ _ _ _ _
  → Verificar código

Home del jurado
  → "Buenas noches, Esteban"
  → "VESTUARIO · Noche de Fantasía"
  → Tus comparsas
    → Luna del Iberá (Continuar →)
    → Guardianes del Carnaval (Comenzar →)

Completar ambas planillas
  → ✓ Votación completada
  → Confirmaste las 2 comparsas asignadas.
  → No tenés votaciones pendientes.
```
