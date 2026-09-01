# Clarificaciones — Spec 010 Resultados

Revisión QA de la Spec 010, sin resolver ni codificar. Detecta ambigüedades, contradicciones y huecos.

## Ambigüedad funcional — CRÍTICA (bloquea RF-96)

- **Contradicción entre fuentes sobre el criterio 1 de desempate para Mejor Comparsa:**
  - Confluence C2 «Guía del equipo»: *«Mayor cantidad de rubros nominativos ganados.»
  - Obsidian `Skills/carnival-domain.md`: *«Suma de rubros nominativos»* como base del desempate.
  - Ambos producen resultados distintos. **Requiere confirmación del responsable antes de implementar RF-96.**
  - Interpretación de trabajo provisional (a validar por el responsable al volver): usar la guía operativa de Confluence como baseline por ser el «baseline funcional actual» del equipo. Queda registrada como `[NECESITA ACLARACIÓN]`.

## Ambigüedad de implementación

- **Autoría del sorteo:** ¿lo genera el sistema (aleatorio auditado) o lo ejecuta un operador y el sistema solo registra el resultado? `carnival-domain` dice «con registro auditado», no quién lo genera. Debe definirse antes de implementar el criterio 3.
- **Dónde se expone el resultado en la «etapa autorizada»:** definir si es solo una vista de escrutinio (SCRUTINEER/Escribano/ADMIN) o también un reporte. (Las actas se difieren.)

## Huecos

- Definir comportamiento cuando un rubro no tiene ninguna puntuación (sin ganador de rubro / indefinido).
- Definir qué ocurre si una comparsa no tiene planillas confirmadas en alguna de las noches puntuables (participa o no en el cómputo de su rubro).
- Confirmar si el ranking debe ser consultable por rubro individual además del general.

## Fuera de alcance confirmado

- Penalizaciones, actas, offline-first y publicación externa quedan diferidas; no debe extenderse su implementación.