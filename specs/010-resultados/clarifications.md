# Clarificaciones — Spec 010 Resultados

Revisión QA de la Spec 010, sin resolver ni codificar. Detecta ambigüedades, contradicciones y huecos.

## Ambigüedad funcional — RESUELTA (RF-96)

- **Criterio 1 de desempate para Mejor Comparsa:**
  - Confluence C2 «Guía del equipo»: *«Mayor cantidad de rubros nominativos ganados.»*
  - Obsidian `Skills/carnival-domain.md`: *«Suma de rubros nominativos»* (referencia complementaria, no normativa).
  - **Resolución (2026-09-01, responsable Guido):** se adopta la guía de Confluence como versión oficial por ser la fuente normativa vigente. El criterio 1 cuenta la cantidad de rubros nominativos cuyo primer puesto pertenece a la comparsa empatada.
  - Criterio 2 oficial: ganadora del rubro `BATERIA` (pertenece al catálogo de Confluence).
  - Criterio 3 oficial: sorteo con registro auditado — se difiere a Spec 011 «Sorteo ceremonial con conteo regresivo».

## Ambigüedad de implementación — RESUELTA

- **Autoría del sorteo:** mientras Spec 011 no esté aprobada, el sistema NO genera aleatoriedad. Cuando criterios 1 y 2 no alcanzan, `resolveTieBreaker` arroja `TIE_BREAKER_REQUIRES_MANUAL_DRAW` para que un operador (rol `SCRUTINEER`/`ESCRIBANO`/`ADMIN`) registre el resultado manualmente en la etapa autorizada. Spec 011 reemplazará esta salida por un sorteo ceremonial automatizado (countdown 5→0 + `Math.random()` seedeado, con migración futura a `crypto.randomInt()` cuando el reglamento lo exija).
- **Exposición en «etapa autorizada»:** Spec 010 entrega el resultado consolidado al endpoint de escrutinio para el rol `SCRUTINEER` (más `ESCRIBANO` y `ADMIN`); un reporte descargable es alcance de la spec de actas, diferida.

## Huecos

- Definir comportamiento cuando un rubro no tiene ninguna puntuación (sin ganador de rubro / indefinido).
- Definir qué ocurre si una comparsa no tiene planillas confirmadas en alguna de las noches puntuables (participa o no en el cómputo de su rubro).
- Confirmar si el ranking debe ser consultable por rubro individual además del general.

## Fuera de alcance confirmado

- Penalizaciones, actas, offline-first y publicación externa quedan diferidas; no debe extenderse su implementación.