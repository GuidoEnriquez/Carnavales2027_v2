# Validación — Spec 030

## T04 — Consolidación del seed único

Validada el 2026-09-14. La evidencia de T01–T03 más abajo corresponde a la
versión anterior con varios comandos de seed y se preserva como historia.

### Evidencia T04

| Comando/verificación | Resultado |
|---|---|
| `node --import=dotenv/config --test --test-concurrency=1 src/tests/single-seed.test.js src/db/tests/full-event-users.test.js src/db/tests/full-event-recovery.test.js src/db/tests/full-event-seed.test.js` | 23 passed, 0 failed, 0 skipped |
| `npm.cmd test` en api | 190 passed, 0 failed, 0 skipped; 66,4 s |
| `$env:NODE_ENV = 'development'; npm.cmd run seed:event:full` en api | Correcto: 3 jornadas, 7 comparsas, 36 rubros, 9 jurados/asignaciones, 21 participaciones, cobertura 175, 0 planillas/votos/sanciones iniciales |
| `npm.cmd run db:migrate` en api | No pending migrations; T04 no introduce schema nuevo |
| `npm.cmd run build` en client | Exitoso, 84 módulos, 1,35 s |
| `node --check` en full-event.js, full-event.fixture.js, full-event.users.js, full-event.rubrics.js, full-event.catalog.js y seed-full-event.js | Correcto, sin salida |
| Búsqueda de imports/símbolos/scripts retirados en api/src y README | Sin referencias ejecutables o instrucciones obsoletas |
| `git diff --check` | Sin errores; avisos LF/CRLF de Git |

RF-FULL-11: un único comando npm (`seed:event:full`), un CLI
(`seed-full-event.js`) y auxiliares `full-event.*`. Se retiraron seeds de
ADMIN independiente, Goya básico, test_prueba, ficción, penalizaciones,
evento-test, Spec006 y rubros/usuarios básicos, junto con aliases y helpers
exclusivos. El bootstrap de producción sigue siendo un proceso independiente.

RF-FULL-12: catálogo, datos ESCRIBANO, seed_key y UUIDs del integral se
conservan. ADMIN se aprovisiona con account-service + grantRole desde el
auxiliar de usuarios. Las pruebas de autenticación se trasladaron al integral:
doce cuentas con login/OTP real y secretos 2FA distintos, reset/revocación,
replay concurrente, recuperación, conflictos y suspensión. Las reglas de
puntaje, pendientes e inmutabilidad siguen cubiertas por full-event-seed.test.js
y las suites existentes de API/DB. Los seis tests de fixtures retirados se
sustituyen por cobertura integral y un test nuevo de seed público único:
el total pasa de 195 a 190 sin fallos.

Solo se eliminaron artefactos del repositorio; no se ejecutó limpieza de
registros almacenados en PostgreSQL. La revisión delegada read-only no encontró
hallazgos atribuibles a T04. Las diferencias operativas de T01–T03 (offline
diferido, nominados, penalizaciones y criterio Batería) siguen documentadas.

## Evidencia histórica T01–T03

Implementado y validado automáticamente el 2026-09-14. El evento local quedó
configurado y sin iniciar. Offline, catálogo temporal de penalizaciones y
circuito de nominados conservan las limitaciones de `clarifications.md`.

## Comandos y resultados

| Comando | Ubicación | Resultado |
|---|---|---|
| `$env:NODE_ENV = 'development'; npm.cmd run seed:event:full` dos veces consecutivas | api | Ambas correctas; conteos e identidad de fixture conservados |
| `node --import=dotenv/config --test --test-concurrency=1 src/db/tests/full-event-seed.test.js src/db/tests/migrate.test.js` | api | 11/11 en la revisión inicial; se ampliaron posteriormente los casos de regresión |
| `node --import=dotenv/config --test src/db/tests/schedule-timestamps.test.js` | api | 1/1; migración con datos históricos, reorden OPEN y bloqueo temporal |
| `npm.cmd test` | api | **195 passed, 0 failed, 0 skipped**, 71,6 s; incluye todos los casos ampliados de este incremento |
| `npm.cmd test -- --run src/tests/ScheduledPassTime.test.jsx src/tests/AdminCompetenciaPage.test.jsx` | client | **52 passed**, 2 archivos |
| `npm.cmd test` | client | **310 passed**, 47 archivos; 0 fallidos |
| `npm.cmd run build` | client | Vite exitoso, **84 módulos**, 3,58 s |
| `npm.cmd run db:migrate` | api | `No pending migrations`; 076 aplicada por el seed y repetible |
| `node --check` en full-event.js, full-event.fixture.js, seed-full-event.js, carnival-demo-users.js y tests nuevos de API | api | Correcto, salida vacía |
| `git diff --check` | raíz | Sin errores de whitespace; avisos LF/CRLF de Git |

No hay scripts lint/typecheck/build propios de la API JS. El chequeo de
sintaxis Node no se presenta como typecheck; se ejecutó el build disponible.

## Conteos locales resultantes (salida real, ambas ejecuciones)

```text
✓ Evento: Carnavales Goyanos 2027 - Evento Integral TEST
✓ Jornadas: 3 configuradas (DRAFT)
✓ Comparsas: 7 configuradas
✓ Rubros: 25 nominativos / 11 aleatorios / 36 total
✓ Jurados: 9 configurados
✓ J1 (2027-02-06): 3 asignaciones / 7 posiciones
✓ J2 (2027-02-07): 3 asignaciones / 7 posiciones
✓ J3 (2027-02-13): 3 asignaciones / 7 posiciones
✓ Participaciones y órdenes de pasada: 21
✓ Cobertura comparsa/rubro nominativo: 175 (implícita)
✓ Planillas: 0 iniciales; 9 al abrir las tres jornadas
✓ Votos emitidos: 0
✓ Penalizaciones aplicadas: 0
✓ Evento listo para comenzar (CONFIGURING; readiness válido)
Horarios y sorteo simulados; no oficiales COC. Operación online.
```

ADMIN configurado: `admin@carnavales.local`; nueve cuentas `jury-<especialidad>-0<n>@example.test`;
ESCRIBANO `demo.escrutinio@carnaval.local`; VEEDOR `demo.veedor.integral@example.test`.
Contraseñas y OTP no incluidos en documentación ni salida del seed.

## Cobertura RF

- RF-FULL-01/02/04/05: conteos exactos, jerarquías y estados, nombres visibles,
  clasificación nominativa/aleatoria, especialidades derivadas, un jurado por
  slot, nueve identidades distintas con credencial real y asignación propia
  consultable antes de abrir. Validación con BD nueva y evento ajeno de control.
- RF-FULL-03: las tres permutaciones exactas; posiciones únicas 1..7,
  intervalo 90 minutos, fecha siguiente a medianoche y zona API/UI. 076 conserva
  las filas preexistentes y nuevas columnas NULL; no afecta reorden OPEN.
- RF-FULL-06/07: cero ballots/scores/ventanas iniciales. HTTP ADMIN abre evento,
  jornada 1 y votación; crea tres planillas, otras jornadas no abiertas rechazan
  apertura de votación. Jurados no asignados no leen la planilla; cada jurado
  recibe sus ítems. PENDING/NULL bloquea submit y close. Tras abrir las otras
  jornadas aparecen nueve ballots; 252 filas PENDING/NULL por jornada nueva.
  Se prueban 1..10, rechazo -1/0/11 en escala ordinaria, 0 explícito,
  idempotencia, aislamiento de especialidad e inmutabilidad. Votos de prueba
  solamente en la BD aislada, nunca en el evento local entregado.
- RF-FULL-08: replay concurrente conserva UUIDs, datos y audit count; nombre
  o ítem editado rechaza deriva. Carrera real con editor que mantiene lock:
  seed espera, luego rechaza sin cambiar credenciales. Fallo intermedio de
  configuración hace rollback de evento/marcador y conserva identidades
  recuperables. Evento OPEN rechaza nuevas ejecuciones. VEEDOR con rol de
  perfil INVITED incompatible se rechaza antes de aceptar o mutar invitación.
- RF-FULL-09/10: una auditoría de sistema con fixture/version/officialData=false,
  sin contraseña; historial de identidades obligatorio conservado. Producción
  y configuración inválida se rechazan antes de acceder a BD. Las regresiones
  de Spec029 (login/OTP, restablecimiento, reintentos) pasan en suite completa.

## Revisión y entorno

La revisión delegada señaló cuatro hallazgos: rol VEEDOR antes de aceptar,
lock antes de procesar usuarios, deriva de campos descriptivos y coherencia
zona/offset. Todos corregidos con tests; revisión de seguimiento sin remanentes.

El test integral usa BD nueva `demo_seed_test_*` con permiso CREATEDB en el
servidor de TEST_DATABASE_URL. La ejecución final conservó
`demo_seed_test_3842457ade424afda24ec6c9010e69a7` como evidencia del fixture
integral. La prueba histórica de 076 usa un esquema dentro de una transacción
que termina en rollback. No se ejecutan DROP ni limpieza destructiva de datos.

UI: se añadió únicamente lectura semántica `<time>` en la fila existente
con flex-wrap; sin CSS/layout ni controles nuevos. Validación automatizada
de fecha/zona, datos históricos/erróneos e integración; no se afirma revisión
visual manual del nuevo texto en navegador. Los cambios concurrentes de
eventos, eliminación lógica y otras pantallas no son entregables de Spec030.

Pendiente de dominio detectado al revisar trazabilidad: `results-service.js`
busca código BATERIA para el criterio 2 de desempate y el catálogo usa
BATERIA_COMPARSA. Se conserva el contrato solicitado y se registra
`[NECESITA ACLARACIÓN]` en clarifications.md; no se declara validación de ese
criterio con este fixture. No bloquea crear/configurar/abrir la competencia.
