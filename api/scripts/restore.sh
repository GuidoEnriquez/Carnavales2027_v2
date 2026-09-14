#!/usr/bin/env bash
# Restore de un dump a una base destino (scratch o piloto en ventana de corte).
# Uso: ./scripts/restore.sh <dump> <DATABASE_URL_DESTINO>
# Verifica checksum, recrea la base vacía y restaura. NUNCA corre solo en prod.
set -euo pipefail
DUMP="${1:?dump requerido}"
TARGET="${2:?DATABASE_URL destino requerido}"
[ -f "$DUMP" ] || { echo "ERROR: no existe $DUMP"; exit 1; }
[ -f "$DUMP.sha256" ] && sha256sum -c "$DUMP.sha256" || echo "AVISO: sin checksum para verificar"
DBNAME="$(echo "$TARGET" | sed -E 's|.*/([^/?]+).*|\1|')"
BASE="$(echo "$TARGET" | sed -E 's|/[^/]*$|/postgres|')"
psql "$BASE" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DBNAME' AND pid<>pg_backend_pid();" >/dev/null
psql "$BASE" -c "DROP DATABASE IF EXISTS \"$DBNAME\";" >/dev/null
psql "$BASE" -c "CREATE DATABASE \"$DBNAME\";" >/dev/null
pg_restore --no-owner --dbname="$TARGET" "$DUMP"
echo "RESTORE OK: $DUMP -> $DBNAME"
