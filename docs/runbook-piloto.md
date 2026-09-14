# Runbook de piloto — backup/restore

Procedimiento ensayado 2026-09-14 (backup de test 716K → restore en scratch
idéntico: 346 eventos + 117 ballots; scratch eliminada tras verificar).

## Backup (antes de cualquier ventana operativa)

```bash
cd api
DATABASE_URL="<prod>" npm run db:backup -- backups/carnavales-$(date +%Y%m%d-%H%M).dump
```

Genera `.dump` + `.sha256`. Guardar copia fuera del servidor.

## Restore (rollback)

```bash
cd api
bash scripts/restore.sh <dump> "<DATABASE_URL destino>"
```

Verifica checksum, recrea la base vacía y restaura. Ensayado contra scratch,
nunca directo en prod sin ventana de corte (termina conexiones primero).

## Orden de arranque limpio

1. `auth:migrate` (tablas Better Auth) — SIEMPRE antes que `db:migrate`.
2. `db:migrate` (76 migraciones, idempotente).
3. `bootstrap:admin` una sola vez (exige `NODE_ENV=production`).
4. `audit:verify` íntegro antes de operar.

## Env de producción (plantilla, valores fuera del repo)

```bash
NODE_ENV=production
DATABASE_URL=postgres://USER:***@HOST:5432/carnavales2027
TRUST_PROXY=1              # o IP del proxy real, nunca 0/true en prod
BETTER_AUTH_SECRET=<64 hex aleatorios, rotado>
BETTER_AUTH_URL=https://api.tudominio
FRONTEND_URL=https://tudominio
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@tudominio   # remitente del OTP y del recupero de contraseña
SMTP_HOST / SMTP_PORT=587 / SMTP_SECURE=false
SMTP_USER / SMTP_PASSWORD=<app password>
```

Verificación punta a punta: registro por invitación → OTP por mail → login
con 2FA → abrir jornada → votar → cerrar.

## Rotación de secretos (hacer una vez antes del piloto)

1. Generar `BETTER_AUTH_SECRET` nuevo (64 hex).
2. Cambiar password de DB y SMTP app-password.
3. Actualizar `.env` prod, reiniciar API, verificar login + OTP.
4. El `.env` local de desarrollo NO se reutiliza en prod.

## Recupero de contraseña (operador)

- La persona pide el enlace o el ADMIN lo envía desde Personas → **Enviar enlace** (con confirmación).
- El correo llega con el enlace a `#/reset-password?token=...`; el token es de un solo uso y vence.
- Si no llega: verificar `EMAIL_FROM`/SMTP en prod, spam, y que la cuenta exista con ese correo.
- En desarrollo (`EMAIL_PROVIDER=console`) el enlace aparece en la terminal de la API.

## Apertura/cierre de jornada (operador)

- Todo desde UI con ADMIN+2FA: Eventos → abrir votación; Supervisión →
  monitorear; Cierre exige planillas completas (bloquea con faltantes).
- Ante incidente: backup inmediato, rollback por restore en ventana de
  corte, `audit:verify` post-restore.
- Responsable de guardia y contactos: completar aquí antes del piloto.
