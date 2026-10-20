#!/usr/bin/env bash
# Copy the source MongoDB database into the Oracle MongoDB API target:
# mongodump from SOURCE_URI, then mongorestore --drop into TARGET_URI.
#
# Usage (from the repo root):
#   export TARGET_URI='mongodb://MERN26:<password>@<adb-host>:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&tls=true'
#   scripts/workshop/migrate-data.sh
#
# Environment:
#   SOURCE_URI  source MongoDB URI naming the database
#               (default mongodb://127.0.0.1:27017/mern_ecommerce)
#   TARGET_URI  REQUIRED. Oracle MongoDB API URI naming database mern26.
#               Write $external as %24external (a literal $external is rewritten for you).
#   DUMP_DIR    dump directory (default ./dump)
#
# Restores from <DUMP_DIR>/<source database> (a URI that names a database needs the
# database directory; the dump root restores 0 documents and still exits 0).
# Exits non-zero if mongodump/mongorestore fail or 0 documents were restored.
# Credentials are masked in everything this script prints.
#
# PowerShell twin: scripts/workshop/migrate-data.ps1 (-SourceUri -TargetUri -DumpDir).
set -euo pipefail

SOURCE_URI="${SOURCE_URI:-mongodb://127.0.0.1:27017/mern_ecommerce}"
TARGET_URI="${TARGET_URI:-}"
DUMP_DIR="${DUMP_DIR:-./dump}"

die() { echo "ERROR: $*" >&2; exit 1; }
mask() { sed -E 's#//[^/]*@#//***:***@#g'; }
# Run a tool, print its credential-masked output (kept in $LOG), die if it exits non-zero.
run_tool() {
  local rc=0
  "$@" 2>&1 | mask | tee "$LOG" || rc=$?
  [ "$rc" -eq 0 ] || die "$1 failed (exit $rc)"
}

[ -n "$TARGET_URI" ] || die "TARGET_URI is not set (Oracle MongoDB API URI naming database mern26)"
command -v mongodump >/dev/null 2>&1 || die "mongodump not found: install the MongoDB Database Tools"
command -v mongorestore >/dev/null 2>&1 || die "mongorestore not found: install the MongoDB Database Tools"

# $external -> %24external (the dollar sign must be percent-encoded in a URI)
TARGET_URI="${TARGET_URI//\$external/%24external}"

# database name = first path segment after the authority, query string removed
db_of() {
  local rest="${1%%\?*}"
  rest="${rest#*://}"
  case "$rest" in
    */*) rest="${rest#*/}"; echo "${rest%%/*}" ;;
    *) echo "" ;;
  esac
}

SOURCE_DB="$(db_of "$SOURCE_URI")"
TARGET_DB="$(db_of "$TARGET_URI")"
[ -n "$SOURCE_DB" ] || die "SOURCE_URI must name the database (e.g. mongodb://127.0.0.1:27017/mern_ecommerce)"
[ -n "$TARGET_DB" ] || die "TARGET_URI must name the database mern26 (.../mern26?loadBalanced=true&...)"
if [ "$(printf '%s' "$TARGET_DB" | tr '[:upper:]' '[:lower:]')" != "mern26" ]; then
  echo "WARNING: TARGET_URI names database '$TARGET_DB', not mern26." >&2
fi

echo "Source: $(printf '%s' "$SOURCE_URI" | mask)  (database $SOURCE_DB)"
echo "Target: $(printf '%s' "$TARGET_URI" | mask)  (database $TARGET_DB)"
echo "Dump:   $DUMP_DIR"

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

echo
echo "== mongodump =="
run_tool mongodump --uri "$SOURCE_URI" --out "$DUMP_DIR"
[ -d "$DUMP_DIR/$SOURCE_DB" ] || die "mongodump produced no $DUMP_DIR/$SOURCE_DB directory"

echo
echo "== mongorestore =="
run_tool mongorestore --drop --writeConcern '{w:1}' --uri "$TARGET_URI" "$DUMP_DIR/$SOURCE_DB"

RESTORED="$(sed -nE 's/.*[^0-9]([0-9]+) document\(s\) restored successfully.*/\1/p' "$LOG" | tail -n 1)"
FAILED="$(sed -nE 's/.*[^0-9]([0-9]+) document\(s\) failed to restore.*/\1/p' "$LOG" | tail -n 1)"
RESTORED="${RESTORED:-0}"
FAILED="${FAILED:-0}"

echo
if [ "$RESTORED" -le 0 ]; then
  die "0 documents restored: check that the URI names the database and DUMP_DIR holds <db>/ (see the header)"
fi
if [ "$FAILED" -gt 0 ]; then
  die "$FAILED document(s) failed to restore"
fi
echo "OK: $RESTORED document(s) restored into $TARGET_DB."
