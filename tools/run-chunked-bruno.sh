#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
port_base=$((30000 + $$ % 20000))
fake_port=$port_base
api_port=$((port_base + 1))
fake_pid=
api_pid=
db_file=

stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    xargs -r kill <<<"$pids" || true
  fi
}

cleanup() {
  stop_port "$api_port"
  stop_port "$fake_port"
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; wait "$api_pid" 2>/dev/null || true; fi
  if [[ -n "$fake_pid" ]]; then kill "$fake_pid" 2>/dev/null || true; wait "$fake_pid" 2>/dev/null || true; fi
  if [[ -n "$db_file" ]]; then rm -f "$db_file" "$db_file-wal" "$db_file-shm"; fi
}
trap cleanup EXIT INT TERM

run_mode() {
  local mode="$1"
  local folder="$2"
  local fake_options="$3"
  local mode_log
  local fake_log
  local api_log
  local db_dir
  local db_path
  local bru_status
  local mode_status
  local -a fake_env=()

  echo "=== chunked Bruno mode: $mode ==="
  mode_log="$(mktemp)"
  fake_log="$(mktemp)"
  api_log="$(mktemp)"
  db_dir="$(mktemp -d)"
  db_path="$db_dir/taskory.sqlite"
  db_file="$db_path"
  stop_port "$api_port"
  stop_port "$fake_port"

  if [[ -n "$fake_options" ]]; then read -r -a fake_env <<<"$fake_options"; fi
  env FAKE_OLLAMA_PORT="$fake_port" "${fake_env[@]}" node "$root_dir/tools/fake-ollama/server.mjs" >"$fake_log" 2>&1 &
  fake_pid=$!
  (cd "$root_dir/apps/api"; exec env JWT_SECRET=x AUTH_RATE_LIMIT=1000 DATABASE_PATH="$db_path" PORT="$api_port" OLLAMA_BASE_URL="http://127.0.0.1:$fake_port" ./node_modules/.bin/ts-node-dev --respawn --transpile-only src/main.ts) >"$api_log" 2>&1 &
  api_pid=$!

  local ready=0
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$api_port/api/v1/health" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:$fake_port/api/tags" >/dev/null 2>&1; then
      ready=1
      break
    fi
    if ! kill -0 "$api_pid" 2>/dev/null || ! kill -0 "$fake_pid" 2>/dev/null; then break; fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "Server startup failed for $mode"
    cat "$fake_log" "$api_log"
    return 1
  fi

  set +e
  (cd "$root_dir/bruno/taskory" && bru run "$folder" --env local --env-var "baseUrl=http://localhost:$api_port/api/v1" --env-var "fakeBaseUrl=http://127.0.0.1:$fake_port" --tests-only -r) | tee "$mode_log"
  bru_status=${PIPESTATUS[0]}
  set -e
  mode_status=0
  if [[ "$bru_status" -ne 0 ]]; then
    echo "Bruno failed in $mode; server output follows"
    cat "$fake_log" "$api_log"
    mode_status="$bru_status"
  fi

  stop_port "$api_port"
  stop_port "$fake_port"
  kill "$api_pid" "$fake_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
  wait "$fake_pid" 2>/dev/null || true
  api_pid=
  fake_pid=
  rm -f "$mode_log" "$fake_log" "$api_log" "$db_file" "$db_file-wal" "$db_file-shm"
  rmdir "$db_dir"
  db_file=
  rm -f "$mode_log" "$fake_log" "$api_log"
  return "$mode_status"
}

run_mode normal reports/chunked/normal ""
run_mode slow reports/chunked/slow "FAKE_OLLAMA_DELAY_MS=2000"
run_mode transient reports/chunked/transient "FAKE_OLLAMA_FAIL_CHUNK=2 FAKE_OLLAMA_FAIL_TIMES=1"
run_mode failure reports/chunked/with-failure "FAKE_OLLAMA_FAIL_CHUNK=2 FAKE_OLLAMA_FAIL_TIMES=3"
run_mode invalid reports/chunked/with-invalid-output "FAKE_OLLAMA_FAIL_CHUNK=2 FAKE_OLLAMA_INVALID_JSON=1"
