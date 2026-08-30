# Carnavales2027_v2

Plataforma configurable de administración para Carnavales, preparada para incorporar votación digital en incrementos posteriores. Goya 2027 es una configuración inicial de referencia, no una restricción del producto.

## Estado del proyecto

Implementado y validado:

- **I1/I1-C:** eventos, noches, categorías, comparsas, especialidades, rubros, ítems, criterios descriptivos, readiness, apertura transaccional y administración de privilegios.
- **I2-A:** padrón de jurados, invitaciones seguras, aceptación, 2FA, suspensión/reactivación y rol `JUDGE`.
- **I2-B:** cupos por noche/especialidad, asignaciones `PRIMARY`/`SUBSTITUTE`, revocaciones, reemplazos auditados y cierre operativo de noches.

Todavía fuera de alcance: planillas, puntuaciones, votación, operación offline/sync, penalizaciones, escrutinio, resultados y actas.

## Arquitectura

```text
api/       # Express, Better Auth, PostgreSQL y migraciones
client/    # React/Vite, panel ADMIN y vistas JUDGE
docs/      # Constitución y mapa de fuentes
specs/     # Requisitos, clarificaciones, tareas y validaciones
```

La autorización real se verifica en la API: sesión, 2FA, rol y estado del perfil. Las guardas del cliente solo orientan la experiencia de usuario.

## Requisitos

- Node.js 20 o superior.
- PostgreSQL 14 o superior.
- Dos bases PostgreSQL separadas para desarrollo y pruebas.

## Instalación local

Instalar dependencias en ambos módulos:

```bash
cd api && npm ci
cd ../client && npm ci
```

Crear `api/.env` a partir de [`api/.env.example`](api/.env.example), completar las conexiones PostgreSQL y generar un secreto local:

```bash
openssl rand -base64 32
```

Configurar el resultado como `BETTER_AUTH_SECRET`. Luego, desde `api/`:

```bash
npm run auth:migrate
npm run db:migrate
NODE_ENV=development npm run db:seed
NODE_ENV=development npm run db:seed:goya
npm run dev
```

El seed ADMIN usa `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` y `SEED_ADMIN_PASSWORD`. El seed de Goya crea solo datos iniciales sugeridos: evento, noches, categoría y especialidades; no crea comparsas, rubros ni ítems completos.

En otra terminal, desde `client/`:

```bash
npm run dev
```

Abrir `http://localhost:5173/#/login`. En desarrollo, Vite redirige `/api` a `http://localhost:3000` y conserva el flujo same-origin.

## Roles y rutas de cliente

- `#/admin/events`: configuración y apertura de eventos.
- `#/admin/judges`: padrón e invitaciones de jurados.
- `#/admin/assignments`: cupos, asignaciones y reemplazos.
- `#/judge`: consulta de asignaciones propias; no habilita votación.
- `#/invitations/accept`: aceptación de invitaciones.

Las rutas protegidas requieren 2FA verificado. `ADMIN` administra el sistema; `JUDGE` solo accede a sus capacidades autorizadas y a sus asignaciones activas.

## API principal

La API expone, entre otros, estos contratos bajo `/api/v1`:

- `GET /me`
- `GET/POST /judges`
- `POST /judges/:judgeId/invitations`
- `POST /judges/:judgeId/suspend`
- `POST /judges/:judgeId/reactivate`
- `GET /events/:eventId/judge-assignments`
- `PUT /events/:eventId/nights/:nightId/specialties/:specialtyId/judge-quota`
- `POST /events/:eventId/judge-assignments`
- `POST /judge-assignments/:assignmentId/revoke`
- `POST /judge-assignments/:assignmentId/replace`
- `GET /judge/assignments`

## Producción

Antes de iniciar producción:

```bash
npm run auth:migrate
npm run db:migrate
npm run bootstrap:admin
npm start
```

El bootstrap requiere `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` y `BOOTSTRAP_ADMIN_PASSWORD`, y solo puede ejecutarse una vez. Producción requiere `EMAIL_PROVIDER=smtp`, `SMTP_*`, `EMAIL_FROM`, `BETTER_AUTH_URL`, `FRONTEND_URL`, HTTPS y un secreto fuerte.

El cliente no es servido por la API. En producción se necesita un reverse proxy o servidor same-origin que sirva el cliente y reenvíe `/api` a la API; el proxy de Vite es solo para desarrollo.

## Validación

Desde `api/`:

```bash
npm test
npm run db:test
npm run db:migrate -- --status
npm audit
```

Desde `client/`:

```bash
npm test
npm run build
npm audit
```

Las pruebas PostgreSQL requieren que `TEST_DATABASE_URL` apunte a una base aislada. La evidencia detallada está en [`specs/002-jurados-asignaciones/validation.md`](specs/002-jurados-asignaciones/validation.md).

## SDD y seguridad

- [Constitución](docs/constitution.md)
- [Mapa de fuentes](docs/source-map.md)
- [Spec 001](specs/001-plataforma-votacion-carnavales/spec.md)
- [Clarificaciones](specs/001-plataforma-votacion-carnavales/clarifications.md)
- [Tareas I1](specs/001-plataforma-votacion-carnavales/tasks.md)
- [Spec 002](specs/002-jurados-asignaciones/spec.md)
- [Validación I2](specs/002-jurados-asignaciones/validation.md)
- [Plan I2-B](.hermes/plans/2026-08-30_i2-b-cupos-asignaciones.md)

No commitear `.env`, contraseñas, tokens ni secretos. No existe autoasignación pública de `ADMIN`. La seguridad del sistema se aplica del lado del servidor.
