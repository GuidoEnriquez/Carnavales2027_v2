# Spec 017 - Configuracion de competencia

## Estado

- **Fase SDD:** aprobada para implementacion el 2026-09-07 por decision del responsable del producto en esta sesion.
- **Incremento activo:** configuracion administrativa de competencia.
- **Fuentes:** decision de producto del 2026-09-07, Spec 001 y Spec 010.

## Objetivo

Separar la administracion general del evento de la configuracion competitiva y representar de forma explicita la jerarquia EVENTO -> COMPETENCIA -> RUBRO -> ITEM PUNTUABLE -> CRITERIO, sin alterar votos confirmados, resultados liberados ni las reglas vigentes de completitud.

## 1. Cambios confirmados de arquitectura y modelo

- Separar Evento y Competencia como areas administrativas sobre el mismo evento configurado.
- Reutilizar `event_category` como tipo de participacion; no crear una entidad paralela.
- Vincular criterios descriptivos a items puntuables preservando los registros historicos.
- Renombrar la clasificacion persistida de rubro a `rubric_type` y ampliar sus valores sin cambiar los calculos cerrados.
- Incorporar orden de item y metadata futura de obligatoriedad y ausencia.
- Incorporar metadata de metodo de resolucion sin ejecutar formulas.
- Derivar la matriz rubro-especialidad desde los items; no persistir una relacion duplicada.

## 2. Reglas provenientes del reglamento y specs aceptadas

- Spec 004 sigue siendo vinculante: cada item generado se resuelve como `SCORED` o `NOT_PRESENTED`; `PENDING` bloquea confirmacion y cierre.
- Spec 007 sigue siendo vinculante: cada decision confirmada por item es inmutable.
- Spec 010 sigue siendo vinculante: Mejor Comparsa usa exclusivamente rubros `NOMINATIVE`; `RANDOM` conserva ganador de rubro sin sumar al ranking general.
- Los criterios descriptivos no reciben puntuacion independiente.
- No se incorpora el `5 por equidad`, formulas COC ni publicacion externa.

## 3. Decisiones UX confirmadas

- Evento muestra identidad, jornadas y preparacion general.
- Competencia concentra comparsas, tipos de participacion, especialidades, rubros, items, criterios y matriz derivada.
- Los criterios se presentan dentro de su item puntuable.
- Los criterios historicos sin asignacion se muestran como pendientes de correccion, sin ocultarlos ni eliminarlos.
- La interfaz usa codigos autogenerados para reducir escritura manual, manteniendo validacion del servidor.

## 4. Reglas pendientes de resolucion COC

- No se definieron formulas para rubros `CALCULATED` ni para resolucion `COMMITTEE` o `AUTOMATIC`; en Spec 017 son solo metadata.
- No se definio el efecto reglamentario de `required=false` o `allow_not_presented=false`; en Spec 017 son solo metadata y no alteran Spec 004.
- **[NECESITA ACLARACION]** No se definio si abrir la competencia cambia `PUBLISHED` a `LOCKED`, exige bloqueo manual previo o conserva `PUBLISHED`.

## Alcance

- Separar en el cliente las secciones Evento y Competencia.
- Administrar comparsas, tipos de participacion, especialidades, rubros, items puntuables y criterios desde Competencia.
- Reutilizar `event_category` como catalogo tecnico de tipos de participacion; no crear una segunda entidad duplicada.
- Vincular cada criterio descriptivo a exactamente un item puntuable del mismo rubro y evento para nuevas altas.
- Detectar criterios historicos sin item y exigir su reasignacion antes de publicar la configuracion.
- Ampliar la clasificacion de rubros a `NOMINATIVE`, `RANDOM`, `GENERAL`, `CALCULATED` y `SPECIAL`.
- Registrar el metodo de resolucion `JURY`, `COMMITTEE`, `AUTOMATIC` o `ADMINISTRATIVE` como configuracion.
- Mostrar una matriz derivada de rubros por especialidad a partir de los items activos.
- Generar codigos tecnicos desde el nombre cuando el administrador no los informe.
- Preparar los estados de configuracion `DRAFT`, `REVIEW`, `PUBLISHED`, `LOCKED` y de competencia `SCHEDULED`, `OPEN`, `PAUSED`, `CLOSED`.

## Exclusiones

- No implementar formulas automaticas o de Comision Organizadora.
- No generar planillas nuevas ni modificar planillas existentes en este incremento.
- No alterar la semantica de `PENDING`, `SCORED` o `NOT_PRESENTED` de Spec 004.
- No activar Offline-First ni publicacion externa de resultados.
- No implementar borrado fisico de configuracion.

## Requisitos funcionales

- **RF-130.** EL SISTEMA DEBE separar visualmente la configuracion del evento de la configuracion de competencia, manteniendo ambas bajo autorizacion ADMIN y 2FA.
- **RF-131.** EL SISTEMA DEBE reutilizar el catalogo `event_category` como tipo de participacion de comparsa; NO DEBE crear un catalogo paralelo sin relacion operativa.
- **RF-132.** CADA criterio descriptivo nuevo DEBE identificar exactamente un item puntuable perteneciente al mismo rubro y evento.
- **RF-133.** LOS criterios historicos que no puedan reasignarse de forma inequivoca DEBEN conservarse, exponerse como pendientes de reasignacion y bloquear la publicacion de la configuracion.
- **RF-134.** SI un rubro historico tiene exactamente un item activo, LA MIGRACION DEBE vincular automaticamente sus criterios sin item a ese item.
- **RF-135.** UN criterio descriptivo NO DEBE recibir puntuacion independiente. Spec 017 reemplaza Spec 001/RF-01y solo respecto de su pertenencia directa al rubro y su ausencia de impacto en readiness: un criterio sin item bloquea publicacion; un criterio correctamente asignado no agrega una condicion de completitud.
- **RF-136.** EL SISTEMA DEBE admitir los tipos de rubro `NOMINATIVE`, `RANDOM`, `GENERAL`, `CALCULATED` y `SPECIAL` sin hardcodear nombres reglamentarios.
- **RF-137.** PARA preservar Spec 010, solo `NOMINATIVE` DEBE integrar Mejor Comparsa y `RANDOM` DEBE conservar ganador de rubro sin integrar Mejor Comparsa. Los tipos nuevos NO DEBEN integrar Mejor Comparsa ni activar formulas automaticas en este incremento.
- **RF-138.** EL SISTEMA DEBE almacenar el metodo de resolucion del rubro como metadata. `AUTOMATIC` y `COMMITTEE` NO DEBEN ejecutar calculos ni decisiones sin una spec posterior.
- **RF-139.** CADA item puntuable DEBE tener un orden positivo y unico dentro de su rubro. Para consumidores existentes que omitan el orden, el servidor DEBE asignar el siguiente orden disponible.
- **RF-140.** `required` y `allow_not_presented` DEBEN almacenarse como metadata futura. Durante Spec 017 todos los items generados conservan las reglas de Spec 004: deben resolverse y admiten la accion explicita `NOT_PRESENTED`.
- **RF-141.** CUANDO falte un codigo en altas admitidas, EL SERVIDOR DEBE derivarlo de forma deterministica desde el nombre y continuar aplicando unicidad por alcance.
- **RF-142.** LA matriz de planillas DEBE ser una vista derivada de rubros, items activos y especialidades; NO DEBE persistir relaciones duplicadas ni crear planillas operativas.
- **RF-143.** SOLO `DRAFT` DEBE admitir modificaciones de configuracion. `REVIEW`, `PUBLISHED` y `LOCKED` DEBEN ser de solo lectura; las correcciones desde `REVIEW` requieren volver a `DRAFT`.
- **RF-144.** LA persistencia DEBE poder representar los estados de configuracion y competencia indicados sin invalidar el estado historico de eventos existentes.

## Ampliacion aprobada para ejecucion incremental

- **RF-145.** El constructor DEBE permitir crear y editar rubros NOMINATION con el tipo de sujeto soportado por el servidor. Los formularios DEBEN conservar entradas ante errores y bloquear envios repetidos durante guardado.
- **RF-146.** Los controles DEBEN tener nombres accesibles y explicar que required, allow_not_presented y metodos de resolucion son metadata futura sin cambiar reglas de voto.
- **RF-147.** Rubros DEBE ofrecer busqueda y filtros por tipo, especialidad y estado, y un flujo jerarquico de creacion no permanentemente expandido.
- **RF-148.** La matriz y rubros DEBEN permitir preview por especialidad, sin crear votos, planillas ni auditoria de votacion.
- **RF-149.** La configuracion DEBE permitir subir/bajar orden mediante operaciones atomicas autorizadas, preservando unicidad y pertenencia.
  En T08 los items se mueven dentro del rubro y los criterios entre vecinos del mismo item, conservando sus posiciones unicas por rubro. Incluye registros inactivos visibles en administracion. Los pendientes sin item deben reasignarse antes de reordenarse. Las solicitudes obsoletas se rechazan sin intercambiar de nuevo posiciones.
- **RF-150.** Los datos historicos ambiguos de participacion DEBEN conservarse y requerir revision explicita, sin conversion por nombre.
- **RF-151.** Las jornadas DEBEN validarse en cliente y servidor conforme a las decisiones temporales pendientes; no se deduce el anio del nombre ni se corrigen fechas automaticamente.
- **RF-152.** Las correcciones de configuracion publicada DEBEN crear una version sucesora auditable sin mutar historia ni reasignar consumidores silenciosamente. La vigencia y transiciones dependen de las aclaraciones pendientes.

## Requisitos no funcionales ampliados

- **RNF-30.** La migracion DEBE ser incremental, reproducible, transaccional y sin perdida de datos.
- **RNF-31.** Las referencias criterio-item DEBEN validarse tambien en PostgreSQL, no solo en la API.
- **RNF-32.** Los contratos existentes de resultados, penalizaciones, actas, seeds y pruebas DEBEN migrarse sin degradar Specs 010, 014 y 015.
- **RNF-33.** La interfaz DEBE funcionar con teclado y en 390x844, 768x1024 y 1440x900.
- **RNF-34.** Toda escritura DEBE mantener auditoria sin exponer secretos ni relajar el filtro de campos sensibles.

## Ampliacion T09a/T09b - Ficha de comparsa y orden de pasada (2026-09-10)

- **RF-141b.** `brand_color` (columna 069, formato `^#[0-9A-Fa-f]{6}$`, nullable) DEBE exponerse en `POST/PATCH/GET` de troupes como `brandColor`; valor ausente o vacio conserva NULL; formato invalido se rechaza con 400 sin tocar auditoria de votos.
- **RF-147b.** La seccion Comparsas DEBE ofrecer busqueda por nombre y filtros por tipo de participacion y estado (Todas/Activas/Inactivas), sin ocultar registros: filtrar solo afecta la vista.
- **RF-148b.** La ficha DEBE ofrecer un preview de solo lectura "Vista jurado" (nombre + banda de color + tipo) que NO crea votos, planillas ni auditoria de votacion.
- **RF-149b.** El orden de pasada (`night_troupe_schedule.presentation_order`, unico por jornada) DEBE poder consultarse por jornada desde Competencia y reordenarse con operaciones atomicas Subir/Bajar con control de concurrencia optimista (409 ante solicitud obsoleta); no abre votacion ni cambia readiness/apertura vigentes.

## Criterios de aceptacion

1. No existe una tabla nueva de tipos de participacion; la UI usa el catalogo existente.
2. Un criterio nuevo sin item valido es rechazado y una referencia cruzada de rubro/evento falla tambien en BD.
3. Los criterios historicos se preservan y se reasignan automaticamente solo cuando existe un unico item posible.
4. La suite de resultados sigue demostrando que Mejor Comparsa usa exclusivamente rubros nominativos.
5. La matriz administrativa se deriva de items y especialidades sin persistencia nueva.
6. Migraciones, API, cliente, build y comprobaciones de tipos/lint aplicables finalizan sin fallos antes del cierre.
