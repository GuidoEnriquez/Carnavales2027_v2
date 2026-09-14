# Validación — Spec 029

Validada el 2026-09-14. Se corrigieron selección arbitraria de ADMIN,
contraseña en código/log, recuperación incompleta y tests dependientes de
datos previos. La suite anterior había fallado en un test histórico de
criterios durante ediciones concurrentes de eventos; la ejecución final
completa pasó con el árbol actual.

## Evidencia ejecutada

Comandos en Windows/PowerShell, desde `api/` salvo indicación.

| Comando | Resultado |
|---|---|
| `node --import=dotenv/config --test --test-concurrency=1 src/db/tests/carnival-demo-users.test.js src/db/tests/carnival-demo-recovery.test.js src/db/tests/carnival-rubrics-seed.test.js` | 12 passed, 0 failed, 0 skipped |
| `$env:NODE_ENV = 'development'; npm.cmd run seed:test` | 36 rubros, 7 comparsas TEST, cobertura implícita 175; ADMIN + 3 JUDGE + ESCRIBANO reutilizados; validaciones correctas |
| `npm.cmd test` | 181 passed, 0 failed, 0 skipped; incluye API, persistencia y resultados; 52,7 s |
| `npm.cmd run db:migrate` | `No pending migrations`; sin migración nueva de este incremento |
| `npm.cmd run build` desde `client/` | Vite exitoso, 83 módulos, 1,19 s |
| `node --check` sobre seed de usuarios, CLI, dos tests de usuarios/recuperación y helper de entorno | salida vacía, éxito |
| `git diff --check` | sin errores de whitespace (avisos de normalización LF/CRLF de Git) |

No existen scripts propios de lint/typecheck/build para la API JavaScript.
Se verificó sintaxis Node y el build disponible del cliente. La revisión de
código delegada identificó dos hallazgos (ADMIN interrumpido y revocación);
ambos se corrigieron y la revisión de seguimiento no encontró pendientes.

## Matriz de cobertura

- RF-DEMO-01: BD sin usuarios → 5 identidades, roles exclusivos, 3 perfiles
  JUDGE y 1 operativo REGISTERED; catálogo Goya y cuatro jornadas iniciales.
- RF-DEMO-02: verificación real de contraseña; rotación de las cinco cuentas,
  rechazo de contraseña anterior y sesiones revocadas; salida y auditoría
  sin contraseña; rechazo de cuenta ajena sin credencial coincidente.
- RF-DEMO-03: ejecución doble/concurrente con pool máximo 1 conserva IDs y
  hashes; bootstrap interrumpido se completa probando credencial; invitaciones
  con entrega fallida se reemiten y consumen conservando perfiles e historia;
  replay completa revocación de sesión con contraseña ya coincidente.
- RF-DEMO-04: login/OTP mediante Better Auth real para las cinco cuentas,
  sesión sin 2FA antes de verificación, habilitada después; cinco secretos
  2FA diferentes; cero ballots creados. Regresiones API de roles y escrutinio
  incluidas en suite completa.
- RF-DEMO-05: rechazo de producción, entorno ausente/staging y contraseña
  inválida antes de conectar; composición CLI ejecutada en BD local y vacía.

## Salida local de usuarios (extracto real)

```text
✓ admin: admin@carnavales.local (reutilizado)
✓ jurado: demo.jurado1@carnaval.local (reutilizado)
✓ jurado: demo.jurado2@carnaval.local (reutilizado)
✓ jurado: demo.jurado3@carnaval.local (reutilizado)
✓ escribano: demo.escrutinio@carnaval.local (reutilizado)
✓ contraseña común: configurada en el entorno local
  (2FA por OTP se completa en el primer login)
✓ validaciones correctas
```

## Entorno y límites de evidencia

Los tests nuevos requieren CREATEDB en el servidor configurado por
TEST_DATABASE_URL. Conservan bases `demo_seed_test_*` con credenciales
aleatorias exclusivamente de prueba, sin ejecutar DROP ni limpiar historia.
La suite final conservó `demo_seed_test_b6f7aa137b0042258c18f59b9b1282d0` y
`demo_seed_test_23cf1e4706144530b812cb828ca85be1` como evidencia.

No hubo cambios de UI en este incremento. Asignar jurados, abrir/cerrar la
votación y ejecutar el escrutinio son los flujos operativos existentes; el
seed de cuentas no los ejecuta. El catálogo conserva los ítems integrales
de testing confirmados previamente, no una planilla oficial por especialidad.
