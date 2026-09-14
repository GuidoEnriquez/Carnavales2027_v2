# Spec 030 — Evento integral de prueba

Fuente: solicitud directa de producto del 2026-09-14, fixture FULL_EVENT
2027.2. Aprobada para implementar el seed según equivalencias del modelo
existente. Fechas, personas, horarios y orden son ficticios, nunca COC oficial.

- **RF-FULL-01:** `seed:event:full` crea un único evento identificado por
  `configuration_seed.seed_key=carnavales-goya-2027-integral-test`, nombre
  solicitado, tres jornadas COMPETITION/DRAFT y readiness true. Evento
  CONFIGURING, activo, sin abrir jornadas/ventanas de votación.
- **RF-FULL-02:** siete comparsas con nombres ficticios sin TEST, categoría
  PRIMERA, activas; 21 participaciones SCHEDULED con las rotaciones indicadas.
- **RF-FULL-03:** cronograma centralizado con fechas 06/02, 07/02 y 13/02/2027,
  20:30 inicial, intervalo 90 minutos, zona America/Argentina/Cordoba. Persistir
  timestamps completos y zona; pasada 4 corresponde a 01:00 del día siguiente.
  Exponerlos en listado API/Competencia, identificados como programación ficticia.
- **RF-FULL-04:** reutilizar los 25 NOMINATIVE, 11 RANDOM y los ítems integrales
  de testing ya aprobados, sin nuevos criterios ni nominados. Especialidades
  BAILE/VESTUARIO/BATERIA; cobertura nominativa implícita de las siete comparsas.
- **RF-FULL-05:** nueve jurados ficticios distintos, tres por jornada, uno por
  especialidad, PRIMARY/ACTIVE; cuotas configuradas sin suplencias activas.
  Reutilizar Better Auth/seed de identidades para ADMIN/ESCRIBANO y crear VEEDOR.
- **RF-FULL-06:** no generar ballots anticipados: Spec003 los crea al abrir
  votación, uno por jurado/noche. Después de abrir las tres jornadas habrá
  nueve ballots con scores iniciales PENDING/NULL, nunca 63 ballots ficticios.
  Al terminar seed: cero ballots, scores, penalizaciones, reemplazos y releases.
- **RF-FULL-07:** no modificar reglas de score, cierre, secreto, 2FA, reemplazo
  ni cálculo. Offline operativo sigue diferido; no activar cache/outbox.
- **RF-FULL-08:** transacción de configuración, bloqueo concurrente, UUIDs
  persistidos estables, replay sin duplicados ni cambios de configuración.
  Rechazar evento iniciado/inactivo o fixture alterado antes de restablecerlo;
  no adoptar eventos ajenos por nombre ni borrar datos existentes.
- **RF-FULL-09:** un evento auditado EVENT_CONFIGURED_FROM_SEED con actor
  sistema (NULL), fixture/version y cronograma. Conservar auditorías obligatorias
  de identidad, invitaciones y roles. Replay no agrega auditoría de configuración.
- **RF-FULL-10:** solo development/test, preflight antes de migrar; contraseña
  común del entorno (Spec029), sin secretos en código, output ni auditoría.

Validación: conteos derivados del fixture, integridad/rotación/medianoche,
replay concurrente y tras deriva/inicio; apertura normal y PENDING bloqueante;
autorización de jornada/especialidad y roles auxiliares. Horario como texto
semántico en fila existente, sin layout/controles nuevos; test de renderizado
y build, respetando wrap/teclado de la lista vigente.

## Consolidación aprobada — seed único (2026-09-14)

Solicitud de producto: borrar los seeds anteriores y mantener únicamente el
integral con toda su configuración.

- **RF-FULL-11:** `seed:event:full` es el único comando de seed. Retirar CLI,
  aliases y definiciones de fixtures anteriores, incluyendo seed de ADMIN
  independiente; su aprovisionamiento pasa a ser auxiliar interno del integral.
- **RF-FULL-12:** conservar la configuración integral y sus IDs existentes,
  seguridad, recuperación de altas, login/OTP y pruebas de reglas críticas.
  Retirar tests exclusivos de fixtures eliminados y trasladar cobertura de
  identidades al fixture de nueve jurados. No borrar datos existentes de BD.

El bootstrap de producción sigue siendo un proceso operativo independiente,
no un seed de testing. Migraciones y validaciones históricas se conservan.
