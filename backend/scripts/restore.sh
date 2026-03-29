#!/bin/bash
# Reviewly database restore — restores a gzipped SQL backup.
# Usage: ./scripts/restore.sh <path-to-backup.sql.gz>
# ⚠️  This overwrites the current database. Use with caution.

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/restore.sh <backup-file.sql.gz>" >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ File not found: $BACKUP_FILE" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ] && [ -z "$DATABASE_URL" ]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^#' "$ENV_FILE" | grep -v '^$')
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set." >&2
  exit 1
fi

echo "⚠️  WARNING: This will overwrite the current database with: $BACKUP_FILE"
echo "Type 'yes' to continue, anything else to abort:"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "🔄 Restoring from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
echo "✅ Restore complete."
