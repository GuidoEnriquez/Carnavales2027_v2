# Clarificación — Spec 002: Usuarios, jurados y asignaciones

## Estado

- **Fase SDD:** I2-A e I2-B implementadas y validadas.
- **Código:** I2-A e I2-B completadas.

## Decisiones cerradas para I2-A

1. **Partición.** Spec 002 se divide en I2-A, padrón e invitaciones, e I2-B, cupos, asignaciones y reemplazos.
2. **Roles.** I2-A incorpora únicamente `ADMIN` y `JUDGE`. Veedor, Comisario, Escrutinio, Escribano, `NOTARY`, `OBSERVER` y `OPERATOR` se difieren.
3. **Alta.** Solo un ADMIN con 2FA crea el perfil y emite la invitación; se bloquea el registro público autónomo.
4. **Perfil.** Nombre, correo y DNI son obligatorios. El perfil puede existir sin cuenta mientras está invitado y no se elimina físicamente.
5. **Especialidad.** No pertenece al perfil; se seleccionará en cada asignación desde el catálogo scoped por evento.
6. **Invitación.** Secreto de alta entropía, hash SHA-256, 72 horas configurables, una pendiente por perfil, reemisión con revocación y uso único.
7. **Registro.** Aceptar crea y vincula la cuenta, concede `JUDGE` y pasa a `REGISTERED`; el primer acceso debe completar 2FA antes de cualquier ruta protegida.
8. **Suspensión.** Conserva rol e historia, exige acción ADMIN auditada, revoca sesiones y bloquea capacidades por consulta dinámica del perfil.
9. **Privacidad.** Datos personales visibles solo para ADMIN y para el propio titular; auditoría y respuestas nunca incluyen secretos de invitación.
10. **Habilitación.** Registro y rol no habilitan voto; I2-A no crea asignaciones ni rutas de votación.

## Decisiones cerradas para I2-B

1. **Cupos.** El cupo se configura por noche y especialidad. Reducirlo por debajo de las asignaciones activas se rechaza.
2. **Incompatibilidades.** Un jurado puede tener como máximo una asignación activa por noche, aunque las especialidades sean distintas.
3. **Vigencia.** Las asignaciones se crean antes de abrir el evento. Con el evento `OPEN` solo se permiten reemplazos y revocaciones. Una noche `CLOSED` no admite cambios. No se agregan ventanas horarias ni zona horaria en I2-B.
4. **Titularidad y suplencia.** `PRIMARY` y `SUBSTITUTE` son tipos de cada asignación y consumen cupo por igual.
5. **Reemplazos.** Un reemplazo revoca la asignación original y crea otra vinculada, con motivo obligatorio. Su efecto es únicamente futuro; no existen planillas en este incremento.
6. **Impugnaciones.** Se difieren para un incremento posterior.
7. **Auditoría de asignación.** Alta, revocación y reemplazo requieren ADMIN con 2FA, motivo cuando corresponda y auditoría con estado anterior/posterior, noche, especialidad, jurado y relación de reemplazo.

## Resultado esperado

Cada decisión cerrada debe producir requisitos identificables, contratos API, migraciones incrementales, criterios de aceptación y pruebas antes de autorizar implementación.
