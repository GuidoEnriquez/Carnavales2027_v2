# Carnavales2027_v2

Plataforma configurable de administración y votación para Carnavales. Goya 2027 es la configuración inicial de referencia, no una restricción del producto.

## Seguridad de cliente

Las rutas y guardas del cliente solo orientan la UX. La autorización real —sesión, 2FA y rol `ADMIN`— se verifica exclusivamente en la API antes de exponer o modificar datos.

## Estado

El incremento **I1 — configuración operativa** está implementado y atraviesa su validación final. Incluye administración de eventos, noches, categorías, comparsas, especialidades, rubros e ítems evaluables, más readiness y apertura transaccional. Los módulos de votación y operación competitiva permanecen fuera de alcance.

## Documentación de trabajo

- [Constitución](docs/constitution.md)
- [Mapa de fuentes](docs/source-map.md)
- [Spec 001](specs/001-plataforma-votacion-carnavales/spec.md)
- [Clarificaciones](specs/001-plataforma-votacion-carnavales/clarifications.md)
- [Tareas](specs/001-plataforma-votacion-carnavales/tasks.md)
- [Plan aprobado](.hermes/plans/2026-08-29_091941-i1-configuracion-operativa.md)

## Estructura

```text
api/       # API y persistencia PostgreSQL
client/    # Panel administrativo React
```

## Comandos locales

Copiar `api/.env.example` como `api/.env`, completar valores locales y generar `BETTER_AUTH_SECRET` con `openssl rand -base64 32`. En `api/`:

```bash
npm run auth:migrate
npm run db:migrate
NODE_ENV=development npm run db:seed
NODE_ENV=development npm run db:seed:goya
npm run dev
```

El seed ADMIN toma `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` y `SEED_ADMIN_PASSWORD` exclusivamente desde `api/.env`. El primer acceso habilita 2FA y entrega el OTP por la consola de la API cuando `EMAIL_PROVIDER=console` y el entorno no es producción.

En otra terminal, dentro de `client/`:

```bash
VITE_API_URL=http://localhost:3000 npm run dev
```

Abrir `http://localhost:5173/#/login`. Para verificación automática:

```bash
npm test
npm run build
```

En `api/`, las suites PostgreSQL requieren que `TEST_DATABASE_URL` apunte a una base aislada:

```bash
npm test
npm run db:test
npm run db:migrate -- --status
```

## Seguridad

- No commitear `.env` ni secretos.
- No se permite autoasignación pública de `ADMIN`.
- No hay push, merge, deploy ni cambios destructivos sin autorización explícita.
