#!/usr/bin/env bash
# Run one or more sql/26ai scripts in SQLcl against Autonomous AI Database (TLS, no wallet).
#
# Usage (from the repo root):
#   scripts/workshop/run-sql.sh <DB_USER> <file.sql> [file.sql ...]
#   e.g. scripts/workshop/run-sql.sh ADMIN sql/26ai/01_schemas.sql
#
# Environment:
#   ORACLE_CONNECT_STRING  REQUIRED. TLS connect string from the ADB console
#                          (Database connection > TLS authentication; no wallet).
#   DB_PASSWORD            password of ADMIN (and of any other <DB_USER>). Must not contain a double quote.
#   MERN26_PASSWORD        password used when <DB_USER> is MERN26
#   MERN26DV_PASSWORD      password used when <DB_USER> is MERN26DV
#                          The password is chosen per user; it is prompted (hidden) if the selected
#                          variable is unset, so one terminal can run the whole workshop.
#
# SQL substitution variables the sql/26ai scripts need, supplied from env when set
# (an unset variable is simply not defined, so the script's own default applies):
#   MERN26_PASSWORD    -> define mern26_password     01_schemas.sql (required; prompted for 01 if unset)
#   MERN26DV_PASSWORD  -> define mern26dv_password   01_schemas.sql (required; prompted for 01 if unset)
#   MERN_LLM_KEY       -> define mern_llm_key        09_select_ai.sql (OCI Generative AI API key). 09 reads
#                         it from the gitignored sql/26ai/09_select_ai_key.sql; if that file is absent
#                         it is written for the run and removed afterwards. An existing file wins.
#   MERN_LLM_REGION    -> define mern_llm_region     09b_select_ai_acl.sql (default us-phoenix-1)
#   EMBEDDING_DIM      -> define embedding_dim       08_ai_vector_store.sql (default 384)
# Scripts with no variables (02, 03, 03b, 04-07, 10) need none. Secret values must not
# contain a double quote or a newline; the
# variables defined for the SQL scripts (everything but DB_PASSWORD) also no whitespace.
#
# Needs SQLcl 25.2+ (`sql`) on PATH. Each script runs after `whenever sqlerror exit failure`
# (a script's own `whenever` overrides it for that script); exits non-zero on SQL error.
# Passwords travel on SQLcl's stdin, never on its command line.
#
# PowerShell twin: scripts/workshop/run-sql.ps1 (-User, -File).
set -euo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }

[ "$#" -ge 2 ] || die "usage: run-sql.sh <DB_USER> <file.sql> [file.sql ...]"
DB_USER="$1"; shift
[ -n "${ORACLE_CONNECT_STRING:-}" ] || die "ORACLE_CONNECT_STRING is not set (TLS connect string from the ADB console)"
command -v sql >/dev/null 2>&1 || die "SQLcl ('sql') not found on PATH"
for f in "$@"; do [ -f "$f" ] || die "SQL file not found: $f"; done

prompt_secret() { # $1 = prompt text; prints the value
  [ -t 0 ] || die "no terminal to prompt on (\"$1\"): set the matching environment variable"
  local v; read -r -s -p "$1" v; echo >&2; printf '%s' "$v"
}
check_secret() { # $1 = name, $2 = value
  case "$2" in
    *\"*|*$'\n'*) die "$1 must not contain a double quote or a newline" ;;
  esac
}

case "$(printf '%s' "$DB_USER" | tr '[:lower:]' '[:upper:]')" in
  MERN26)   PW_VAR=MERN26_PASSWORD ;;
  MERN26DV) PW_VAR=MERN26DV_PASSWORD ;;
  *)        PW_VAR=DB_PASSWORD ;;
esac
DB_PASSWORD="${!PW_VAR:-}"
[ -n "$DB_PASSWORD" ] || DB_PASSWORD="$(prompt_secret "Password for $DB_USER: ")"
check_secret DB_PASSWORD "$DB_PASSWORD"

for f in "$@"; do
  if [ "$(basename "$f")" = "01_schemas.sql" ]; then
    [ -n "${MERN26_PASSWORD:-}" ] || MERN26_PASSWORD="$(prompt_secret "MERN26 password: ")"
    [ -n "${MERN26DV_PASSWORD:-}" ] || MERN26DV_PASSWORD="$(prompt_secret "MERN26DV password: ")"
  fi
done

KEY_FILE="sql/26ai/09_select_ai_key.sql"
CREATED_KEY_FILE=""
cleanup() { [ -z "$CREATED_KEY_FILE" ] || rm -f "$CREATED_KEY_FILE"; }
trap cleanup EXIT
if [ -n "${MERN_LLM_KEY:-}" ]; then
  check_secret MERN_LLM_KEY "$MERN_LLM_KEY"
  if [ -e "$KEY_FILE" ]; then
    echo "NOTE: $KEY_FILE exists and takes precedence over MERN_LLM_KEY." >&2
  elif [ -d sql/26ai ]; then
    ( umask 077; printf 'set define off\ndefine mern_llm_key = %s\nset define on\n' "$MERN_LLM_KEY" > "$KEY_FILE" )
    CREATED_KEY_FILE="$KEY_FILE"
  fi
fi

for pair in MERN26_PASSWORD:mern26_password MERN26DV_PASSWORD:mern26dv_password \
            MERN_LLM_REGION:mern_llm_region EMBEDDING_DIM:embedding_dim MERN_LLM_KEY:x; do
  name="${pair%%:*}"
  check_secret "$name" "${!name:-}"
  case "${!name:-}" in *[[:space:]]*) die "$name must not contain whitespace" ;; esac
done

{
  echo "set define off"
  [ -z "${MERN26_PASSWORD:-}" ]   || printf 'define mern26_password = %s\n'   "$MERN26_PASSWORD"
  [ -z "${MERN26DV_PASSWORD:-}" ] || printf 'define mern26dv_password = %s\n' "$MERN26DV_PASSWORD"
  [ -z "${MERN_LLM_REGION:-}" ]   || printf 'define mern_llm_region = %s\n'   "$MERN_LLM_REGION"
  [ -z "${EMBEDDING_DIM:-}" ]     || printf 'define embedding_dim = %s\n'     "$EMBEDDING_DIM"
  echo "set define on"
  echo "whenever oserror exit failure"
  echo "whenever sqlerror exit failure"
  printf 'connect %s/"%s"@%s\n' "$DB_USER" "$DB_PASSWORD" "$ORACLE_CONNECT_STRING"
  for f in "$@"; do
    echo "whenever sqlerror exit failure"
    case "$f" in *" "*) printf '@"%s"\n' "$f" ;; *) printf '@%s\n' "$f" ;; esac
  done
  echo "exit"
} | sql -S /nolog
