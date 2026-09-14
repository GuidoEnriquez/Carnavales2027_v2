#!/usr/bin/env bash
# Backup físico de la base del piloto: dump custom + verificación de integridad.
# Uso: DATABASE_URL=... npm run db:backup [destino]
# Salida: backups/carnavales-YYYYmmdd-HHMM.dump (+ .sha256)
set -euo pipefail
DEST="${1:-backups/carnavales-$(date +%Y%m%d-%H%M).dump}"
: "${DATABASE_URL:?DATABASE_URL no definido}"
mkdir -p "$(dirname "$DEST")"
pg_dump --format=custom --compress=6 --file="$DEST" "$DATABASE_URL"
sha256sum "$DEST" > "$DEST.sha256"
echo "BACKUP OK: $DEST ($(du -h "$DEST" | cut -f1))"
