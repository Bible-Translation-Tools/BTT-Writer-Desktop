#!/usr/bin/env bash

set -euo pipefail

# Script lives in e2e_tests/ — one level up is the repository root.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"


DISPLAY="${DISPLAY:-:0}" ./node_modules/.bin/electron src/js/main.js \
  --no-sandbox \
  --remote-debugging-port=9222 \
  --enable-logging \
  2>&1 | tee /tmp/btt-debug.log &

sleep 10s

node --test e2e_tests/e2e/user-profile-setup.spec.mjs
node --test e2e_tests/e2e/project-creation.spec.mjs

sleep 3s

node --test e2e_tests/e2e/project-navigation.spec.mjs
