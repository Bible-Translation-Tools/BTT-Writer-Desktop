#!/usr/bin/env bash

set -euo pipefail

DISPLAY="${DISPLAY:-:0}" ./node_modules/.bin/electron src/js/main.js \
  --no-sandbox \
  --remote-debugging-port=9222 \
  > /tmp/btt-debug.log 2>&1 &
  

sleep 4s && \
node scripts/e2e/btt-user-profile-setup.mjs && \

node scripts/e2e/btt-project-creation.mjs && \

sleep 3s && \

node scripts/e2e/btt-project-navigation.mjs && \

sleep 1s && \

node scripts/e2e/btt-menu-navigation.mjs
