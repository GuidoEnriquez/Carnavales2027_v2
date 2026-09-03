# Checklist — T06 Validación manual Spec 014 (Penalizaciones)

Objetivo: comprobar en navegador (Chrome DevTools → modo dispositivo / emulación responsive) la interfaz de comisariato y el desglose de resultados. Marcá cada caso con ✅ / ❌ / N/A y anotá viewport y evidencia.

## Preparación

- [ ] Levantar API (`cd api && npm run dev`) y cliente (`cd client && npm run dev`).
- [ ] Iniciar sesión con un usuario que tenga rol `COMISARIO` (o `ADMIN`) y 2FA verificado.
- [ ] Tener un evento con al menos una jornada competitiva y comparsas programadas.

## Móvil — 390×844

- [ ] `#/admin/penalties` accesible desde la navegación según rol.
- [ ] Selector de competencia, noche y comparsa alcanzan sin truncarse.
- [ ] Los controles del formulario miden ≥48px de alto y son fáciles de tocar sin precisión (sin depender de hover).
- [ ] Formulario: puntos enteros > 0; motivo obligatorio. Si ingresás 0, −1 o vacío con motivo, muestra mensaje claro.
- [ ] Se registra una sanción correctamente y aparece en el listado con estado "Aplicada".
- [ ] Contraste legible (dark mode institucional) — WCAG AA.
- [ ] Flujo de revocación: abrir modal, motivo obligatorio, confirmar → pasa a "Revocada" y muestra el motivo de revocación.

## Tablet — 768×1024

- [ ] Formulario y listado se leen bien de a dos columnas; no hay superposiciones.
- [ ] Modal de revocación centrado y responsive.
- [ ] Botones de acción (Registrar, Revocar) siguen siendo táctiles (≥48px).

## Desktop — 1440×900

- [ ] Plena visualización del listado de sanciones con columnas Noche / Comparsa / Puntos / Motivo / Estado / Acciones.
- [ ] `#/admin/results`: la tabla de Mejor Comparsa muestra por comparsa **Puntaje bruto** (gross), **Penalizaciones** (− puntos) y **Puntaje final neto** (net).
- [ ] Con una comparsa penalizada se verifica que el neto = max(0, bruto − penalizaciones) y que el orden del ranking lo refleja.

## Teclado y accesibilidad (los 3 viewports)

- [ ] Recorrer el formulario completo con `Tab` en orden lógico.
- [ ] Modal de revocación: foco inicial en el textarea de motivo; `Tab`/`Shift+Tab` no se escapan (tab trap); `Escape` cierra y devuelve el foco al botón "Revocar".
- [ ] El cierre del modal restaura el foco al disparador.
- [ ] Los mensajes de error/success (role=status / role=alert) son leídos por el lector de pantalla.
- [ ] Estados visuales acompañados de texto/ícono (no color como único indicador).

## Reglas de negocio

- [ ] No se puede registrar ni revocar una sanción después de liberar resultados (403 `RESULTS_ALREADY_RELEASED` → mensaje legible).
- [ ] Sin rol autorizado (p. ej. JUDGE o VEEDOR) la ruta `#/admin/penalties` deniega el acceso (mensaje legible).
- [ ] Jurado/veedor no puede gestionar penalizaciones (403).
- [ ] El desglose de resultados solo es visible en la etapa de escrutinio autorizada.

## Notas / hallazgos

Pegar capturas o descripción de cualquier sorpresa. Registrar viewport y paso exacto.

> Pendiente de decisión conocida (de T04, `[NECESITA ACLARACIÓN]`): los endpoints `/api/v1/events`, `/nights` y `/troupes` exigen rol `ADMIN`, mientras los de penalizaciones permiten `ADMIN`+`COMISARIO`. El cliente usa fallback hacia `/api/v1/results/events`. Evaluar en spec futura abrir endpoints de solo lectura para `COMISARIO`.