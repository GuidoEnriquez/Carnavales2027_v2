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
2. `db:migrate` (75 migraciones, idempotente).
3. `bootstrap:admin` una sola vez (exige `NODE_ENV=production`).
4. `audit:verify` íntegro antes de operar.
