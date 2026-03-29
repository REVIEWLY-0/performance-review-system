#!/bin/bash
# Reviewly database backup — dumps the Postgres database to a gzipped SQL file.
# Usage: ./scripts/backup.sh
# Env:   DATABASE_URL must be set (loaded from .env if present)
# Output: backend/backups/reviewly_YYYYMMDD_HHMMSS.sql.gz

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

# Load .env if running locally (not already in environment)
if [ -f "$ENV_FILE" ] && [ -z "$DATABASE_URL" ]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^#' "$ENV_FILE" | grep -v '^$')
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set. Add it to .env or export it before running." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/reviewly_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "🗄️  Backing up database..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
echo "✅ Backup saved to: $BACKUP_FILE"

# Retain last 7 days of backups; delete older ones
find "$BACKUP_DIR" -name "reviewly_*.sql.gz" -mtime +7 -delete
echo "🧹 Cleaned up backups older than 7 days"
