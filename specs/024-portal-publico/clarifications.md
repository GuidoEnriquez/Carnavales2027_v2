# Clarificaciones — Spec 024: Portal Público de Resultados

## 1. ¿Qué información exacta se expone en el portal público?

**Contenido público permitido:**
- Nombre y fecha del evento.
- Estado de escrutinio (Liberado, Empate resuelto, Acta notarial certificada).
- Ganadora de Mejor Comparsa (nombre de comparsa y método si hubo desempate).
- Ranking general de comparsas: puesto, comparsa, puntaje bruto acumulado, total de penalizaciones reglamentarias activas y puntaje neto final.
- Ganadores por rubro artístico: nombre del rubro y comparsa(s) ganadora(s).
- Sello del Acta Oficial: número de acta, fecha/hora de certificación, rol certificante y hash JCS/SHA-256 (64 caracteres hexadecimales).

**Prohibiciones absolutas:**
- Puntajes individuales emitidos por jurados.
- Nombres de jurados asociados a puntuaciones o decisiones específicas.
- Cualquier planilla en borrador o estado no definitivo.

## 2. ¿Cómo protege el snapshot la base de datos durante picos de tráfico (ej. 10.000 usuarios en vivo)?

El portal público **nunca ejecuta JOINs ni consultas a `ballot` ni a `ballot_score`**. Solo realiza una lectura por clave primaria o índice a la tabla `results_snapshot`.
Con las cabeceras HTTP:
- `ETag: "<snapshot_hash>"`
- `Cache-Control: public, max-age=30, stale-while-revalidate=60`
Cualquier reverse proxy (Nginx, Cloudflare, Caddy) o la memoria de los navegadores sirve las solicitudes repetidas con HTTP 304 Not Modified o directamente desde caché sin tocar Node ni PostgreSQL.

## 3. ¿Cómo se versionan los snapshots?

Cada vez que el estado de resultados avanza (ej. Liberación inicial = versión 1; Sorteo ceremonial = versión 2; Certificación notarial del acta = versión 3), se inserta un nuevo registro con `version = version_previa + 1`. El trigger de BD prohíbe `UPDATE` o `DELETE`, preservando la inmutabilidad histórica. La API pública siempre entrega la versión con mayor número de versión (`SELECT ... ORDER BY version DESC LIMIT 1`).
