#!/usr/bin/env bash
# Start (or reuse) the source MongoDB for the migration: container "mern-mongo"
# from mongo:7, published on 127.0.0.1:27017 only.
#
# Usage (from the repo root):
#   scripts/workshop/start-source-mongo.sh          # run or reuse the container, wait for ping
#   scripts/workshop/start-source-mongo.sh stop     # remove the container
#
# Environment:
#   CONTAINER_ENGINE   docker or podman. Default: docker if its daemon answers, else podman.
#
# PowerShell twin: scripts/workshop/start-source-mongo.ps1 (-Engine, -Stop).
set -euo pipefail

NAME="mern-mongo"
IMAGE="mongo:7"
PORT_MAP="127.0.0.1:27017:27017"

die() { echo "ERROR: $*" >&2; exit 1; }

detect_engine() {
  if [ -n "${CONTAINER_ENGINE:-}" ]; then
    command -v "$CONTAINER_ENGINE" >/dev/null 2>&1 || die "CONTAINER_ENGINE='$CONTAINER_ENGINE' not found on PATH"
    echo "$CONTAINER_ENGINE"
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo docker
  elif command -v podman >/dev/null 2>&1; then
    echo podman
  else
    die "no container engine found: install Docker or Podman (or start the Docker daemon)"
  fi
}

ACTION="${1:-start}"
case "$ACTION" in
  start|stop) ;;
  *) die "unknown argument '$ACTION' (use: start | stop)" ;;
esac

ENGINE="$(detect_engine)"

if [ "$ACTION" = "stop" ]; then
  if "$ENGINE" ps -a --filter "name=^${NAME}\$" --format '{{.Names}}' | grep -qx "$NAME"; then
    "$ENGINE" rm -f "$NAME" >/dev/null
    echo "Removed container $NAME ($ENGINE)."
  else
    echo "Container $NAME does not exist; nothing to do."
  fi
  exit 0
fi

if "$ENGINE" ps -a --filter "name=^${NAME}\$" --format '{{.Names}}' | grep -qx "$NAME"; then
  if "$ENGINE" ps --filter "name=^${NAME}\$" --format '{{.Names}}' | grep -qx "$NAME"; then
    echo "Reusing running container $NAME ($ENGINE)."
  else
    echo "Starting existing container $NAME ($ENGINE)."
    "$ENGINE" start "$NAME" >/dev/null
  fi
else
  echo "Creating container $NAME from $IMAGE ($ENGINE)."
  "$ENGINE" run -d --name "$NAME" -p "$PORT_MAP" "$IMAGE" >/dev/null
fi

printf 'Waiting for MongoDB to answer ping'
for _ in $(seq 1 60); do
  if [ "$("$ENGINE" exec "$NAME" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' 2>/dev/null | tr -d '[:space:]')" = "1" ]; then
    echo
    echo "MongoDB is ready: mongodb://127.0.0.1:27017"
    exit 0
  fi
  printf '.'
  sleep 2
done
echo
die "MongoDB did not answer ping within 120 seconds; check: $ENGINE logs $NAME"
