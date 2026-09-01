# Spec 010 — Resultados: consolidación, rankings y desempate

## Estado

- **Fase SDD:** en preparación para aprobación.
- **Fuentes normativas:** Confluence C2 «Guía del equipo» (secciones 6, 8, 9, 10 y 11), Obsidian `Areas/07 - Reglamento y Reglas de Negocio`, `Skills/carnival-domain.md` y `Areas/04 - Negocio y Producto`; reglamento de Goya 2027.
- **Dependencias:** requiere planillas confirmadas (Specs 003/004), cierre de votación (Spec 006), inmutabilidad por ítem (Spec 007) e invariancia de los roles operativos (Spec 008).

## Objetivo

Calcular y exponer los resultados oficiales de una edición de Carnaval de forma **reproducible y auditada**, partiendo de las puntuaciones confirmadas e inmutables: consolidar notas por rubro, determinar rankings, calcular a la Comparsa Ganadora y aplicar el desempate reglamentario (exclusivamente para la Mejor Comparsa).

## Fuera de alcance

- **Penalizaciones/sanciones** (entidad `penalty` y cálculo diferido): se especifica aparte.
- **Actas oficiales con hash** (`acta` + firma + doble control): se especifica aparte.
- **Offline-first / sincronización** (Spec 005): sigue fuera de operación.
- Publicación pública/web de resultados en un canal externo.
- El procedimiento de apertura de sobres (custodia física) y su equivalente de control de acceso: se documenta en la spec de actas/escrutinio operativo.

## Reglas funcionales

- **RF-89 (acumulación).** EL SISTEMA DEBE calcular, para cada rubro y cada comparsa, el puntaje acumulado sumando las notas confirmadas de todos los jurados que evaluaron ese rubro en todas las noches puntuables; reutiliza los valores `SCORED` (1–10) y `NOT_PRESENTED` (0) ya confirmados, sin re-leer ni recalcular el voto original.
- **RF-90 (ganador por rubro).** EL SISTEMA DEBE declarar ganador de un rubro a la comparsa con mayor puntaje acumulado en ese rubro, para rubros nominativos y aleatorios.
- **RF-91 (Mejor Comparsa).** CUANDO se consolida el resultado general, EL SISTEMA DEBE sumar únicamente los rubros **nominativos** para determinar la Comparsa Ganadora; los rubros aleatorios NO se incluyen en este cómputo.
- **RF-92 (ranking).** EL SISTEMA DEBE poder exponer un ranking ordenado por comparsa (de mayor a menor puntaje) para cada rubro y para el cómputo general de Mejor Comparsa.
- **RF-93 (inmutabilidad del resultado).** MIENTRAS los votos confirmados no cambien, EL SISTEMA DEBE producir el mismo resultado (reproducibilidad determinística). Los cálculos no modifican ni el voto ni la planilla originales.
- **RF-94 (secreto hasta la etapa autorizada).** ANTES de la etapa autorizada de escrutinio/resultados, EL SISTEMA DEBE mantener ocultos puntajes consolidados, rankings y resultados para todo rol que no esté autorizado (equivalente al sobre cerrado). La exposición pública de resultados solo ocurre cuando la etapa lo autoriza.
- **RF-95 (desempate solo Mejor Comparsa).** SI al calcular la Mejor Comparsa dos o más comparsas quedan empatadas, EL SISTEMA DEBE aplicar la secuencia reglamentaria de desempate, y SOLO para el premio de Mejor Comparsa.
- **RF-96 (orden de desempate).** CUANDO existe empate en Mejor Comparsa, EL SISTEMA DEBE resolver en este orden: (1) mayor cantidad de rubros nominativos ganados; (2) si el empate persiste, la que resultó ganadora en Mejor Batería; (3) si persiste, sorteo con registro auditado.
- **RF-97 (trazabilidad).** EL SISTEMA DEBE registrar en auditoría cada consolidación, cálculo de ranking, resultado y desempate, sin exponer secretos y conservando la trazabilidad de actor, acción, entidad y evento/correlation id.

## Casos límite a cubrir

- Empate exacto en Mejor Comparsa (dos o más comparsas).
- Empate persistente tras criterio 1 de desempate.
- Empate persistente tras criterio 2 (necesita el desempate por Batería).
- Empate final que requiere sorteo (con registro auditado del sorteo y de quién lo ejecuta).
- Rubros donde ninguna comparsa fue puntuada (sin ganador o caso indefinido).
- Evento sin noches puntuables o sin planillas confirmadas.
- Un solo ganador sin necesidad de desempate.
- Rubros aleatorios que no participan en Mejor Comparsa pero sí tienen ganador de rubro.

## Criterios de finalización

- [NECESITA ACLARACIÓN]: la fuente de Confluence define el criterio 1 de desempate como «mayor cantidad de rubros nominativos ganados», mientras que la nota `carnival-domain` de Obsidian lo describe como «suma de rubros nominativos». Ambas llevan a resultados distintos. Se debe confirmar cuál es el criterio oficial antes de implementar RF-96.
- Los cálculos son determinísticos y reproducibles.
- Los resultados solo se exponen en la etapa autorizada.
- El desempate aplica exclusivamente a Mejor Comparsa.
- Auditoría presente en consolidación, ranking, resultado y desempate.

## Dudas

- `[NECESITA ACLARACIÓN]` Criterio 1 de desempate: ¿«cantidad de rubros nominativos ganados» (Confluence) o «suma de rubros nominativos» (Obsidian)?
- ¿El sorteo se ejecuta por el sistema (generación aleatoria auditada) o lo realiza un operador y el sistema solo lo registra? La spec `carnival-domain` dice «con registro auditado»; falta confirmar quién ejecuta el sorteo.
- ¿Dónde se expone el resultado «etapa autorizada»: solo una vista de escrutinio (rol SCRUTINEER/Escribano/Admin) o también un reporte descargable? (las actas se difieren).