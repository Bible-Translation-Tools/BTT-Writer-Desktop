#!/usr/bin/env bash

set -euo pipefail

# Stream main + renderer Chromium logs to CI stdout and keep a copy for the workflow artifact.
DISPLAY="${DISPLAY:-:0}" ./node_modules/.bin/electron src/js/main.js \
  --no-sandbox \
  --remote-debugging-port=9222 \
  --enable-logging \
  2>&1 | tee /tmp/btt-debug.log &
  

sleep 10s && \
node scripts/e2e/btt-user-profile-setup.mjs && \

node scripts/e2e/btt-project-creation.mjs && \

sleep 3s && \

node scripts/e2e/btt-project-navigation.mjs
