#!/usr/bin/env bash

set -euo pipefail

# Script lives in e2e_tests/ — one level up is the repository root.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ELECTRON_PID=""

start_electron() {
  DISPLAY="${DISPLAY:-:0}" ./node_modules/.bin/electron src/js/main.js \
    --no-sandbox \
    --remote-debugging-port=9222 \
    --enable-logging \
    >> /tmp/btt-debug.log 2>&1 &
  ELECTRON_PID=$!
  # Prevent SIGHUP to the shell when Electron exits (e.g. after CDP Browser.close).
  disown -h "$ELECTRON_PID" 2>/dev/null || true
}

stop_electron() {
  if [[ -n "${ELECTRON_PID:-}" ]] && kill -0 "$ELECTRON_PID" 2>/dev/null; then
    kill "$ELECTRON_PID" 2>/dev/null || true
    wait "$ELECTRON_PID" 2>/dev/null || true
  fi
  ELECTRON_PID=""
}

start_electron
sleep 10s

node --test e2e_tests/e2e/user-login-incorrect.spec.mjs

node e2e_tests/support/close-app.mjs
stop_electron
sleep 2s

start_electron
sleep 10s

node --test e2e_tests/e2e/user-profile-setup.spec.mjs
node --test e2e_tests/e2e/project-creation.spec.mjs

sleep 3s

node --test e2e_tests/e2e/project-navigation.spec.mjs

stop_electron
