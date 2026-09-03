# Spec 014 — Gestión de Penalizaciones (Comisariato)

## Estado

- **Fase SDD:** propuesta para especificación y clarificación (2026-09-03).
- **Fuentes normativas:** Reglamento Goya 2027; Confluence C2 «Guía del equipo y planificación» (sección Penalizaciones); Spec 001 (RF-17, RF-19); Spec 008 (rol `COMISARIO`); Spec 010 (cómputo y liberación de resultados).
- **Dependencias:** rol `COMISARIO` y autenticación 2FA (Spec 008); apertura de noches competitivas (Spec 001/002); consolidación de resultados (Spec 010).

## Objetivo

Permitir al rol `COMISARIO` (y al `ADMIN`), con autenticación 2FA verificada, registrar, auditar y revocar sanciones/penalizaciones reglamentarias por comparsa y jornada competitiva, deduciendo dichos puntos del cómputo general de Mejor Comparsa sin alterar la inmutabilidad de los votos artísticos emitidos por los jurados.

## Alcance

### Incluye:
- Modelo persistente para penalizaciones (`troupe_penalty`), asociado a evento, jornada competitiva y comparsa.
- Tipificación de penalización: comparsa destinataria, jornada de ocurrencia, motivo/concepto reglamentario, y puntos a descontar (valor positivo).
- Autorización estricta: solo roles `COMISARIO` y `ADMIN` con sesión 2FA activa.
- Registro, consulta y revocación auditada de penalizaciones antes de la liberación de resultados.
- Bloqueo de mutabilidad: una vez liberados los resultados oficiales (`results_release`), las penalizaciones quedan estrictamente inmutables.
- Integración con el motor de resultados de Spec 010: el cómputo de Mejor Comparsa calcula `puntaje_bruto` (suma nominativa), `total_penalizaciones` y `puntaje_neto = max(0, bruto - penalizaciones)`, ordenando el ranking por `puntaje_neto`.
- Las penalizaciones NO descuentan notas de los rubros individuales artísticos (los premios por rubro se mantienen basados en la evaluación de sus jurados).
- Interfaz web para el `COMISARIO` y `ADMIN` con listado, formulario de carga, confirmación y revocación.
- Visibilidad en el panel de resultados (`AdminResultsPage`): exposición clara de puntaje bruto, penalizaciones deducidas y puntaje final neto.
- Pruebas automatizadas (DB, API y cliente) y comprobación manual responsive (móvil 390×844, tablet 768×1024, desktop 1440×900, teclado y táctil).

### Excluye:
- Tipos de infracción automatizados mediante sensores o cronómetros de pista (la carga es declarativa por el comisario responsable).
- Deducciones sobre rubros individuales o figuras aisladas.
- Publicación externa masiva (permanece diferida).
- Generación de actas oficiales con firma (alcance de la spec posterior de actas).

## Requisitos Funcionales

- **RF-112 (Modelo y persistencia de penalizaciones).** EL SISTEMA DEBE registrar penalizaciones en una tabla dedicada (`troupe_penalty`) vinculada a un evento, una jornada competitiva (`night`) y una comparsa (`event_troupe`) programada en dicha jornada, con motivo obligatorio y puntos a descontar (número mayor a 0).
- **RF-113 (Autorización con 2FA).** Solo usuarios con rol `COMISARIO` o `ADMIN` con sesión 2FA verificada PUEDEN registrar o revocar penalizaciones.
- **RF-114 (Independencia de la evaluación artística).** Las penalizaciones NO DEBEN modificar, reabrir ni recalcular las planillas, ítems o decisiones confirmadas por los jurados (cumplimiento de RF-17 e inmutabilidad de Spec 007).
- **RF-115 (Ventana de mutabilidad y bloqueo post-liberación).** Las penalizaciones solo PUEDEN registrarse o revocarse MIENTRAS los resultados del evento no hayan sido liberados (`results_release`). Tras la liberación, toda inserción, modificación o revocación DEBE ser rechazada por el servidor y la base de datos.
- **RF-116 (Revocación auditada).** CUANDO una penalización deba anularse antes de la liberación, el usuario autorizado DEBE registrar un motivo de revocación; la penalización no se borra físicamente, sino que transiciona a `REVOKED` y se registra en `audit_event`.
- **RF-117 (Deducción en ranking general de Mejor Comparsa).** AL CALCULAR el ranking de Mejor Comparsa (Spec 010), EL SISTEMA DEBE sumar las penalizaciones activas de cada comparsa y restarlas del puntaje bruto acumulado de rubros nominativos: `totalScore = max(0, grossScore - totalPenalties)`.
- **RF-118 (Preservación de premios por rubro).** Las penalizaciones NO AFECTAN los rankings ni ganadores de rubros individuales (nominativos o aleatorios); el ganador de rubro sigue siendo la comparsa con mayor puntaje artístico acumulado en ese rubro (RF-90).
- **RF-119 (Desglose auditable en resultados).** El endpoint y vista autorizada de escrutinio/resultados DEBEN exponer para cada comparsa: `grossScore`, `penaltyPoints`, `netScore` y el desglose de penalizaciones aplicadas, garantizando transparencia.
- **RF-120 (Experiencia operativa accesible y responsive).** La interfaz de comisariato DEBE ser accesible en móvil (390×844), tablet (768×1024) y desktop (1440×900), con controles táctiles ≥ 48px, navegación por teclado sin trampas de foco y contraste accesible WCAG AA.

## Criterios de Aceptación

1. Un comisario autenticado con 2FA puede registrar una penalización indicando noche, comparsa, motivo y puntos.
2. Un intento de registrar penalizaciones por parte de un `JUDGE`, `VEEDOR` o usuario sin 2FA es rechazado con 403.
3. El cálculo de Mejor Comparsa refleja la deducción de penalizaciones de forma determinística y exacta.
4. Los ganadores de rubro individuales permanecen intactos ante cualquier penalización de comparsa.
5. Tras ejecutar `releaseResults`, cualquier intento posterior de registrar o revocar penalizaciones falla inmediatamente.
6. La interfaz de comisariato y el desglose de resultados se validan con 100% de éxito en móvil, tablet y escritorio.
