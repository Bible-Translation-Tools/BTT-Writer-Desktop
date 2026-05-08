## Start Electron with the CDP debug port
Instead of pnpm start, launch Electron directly with --remote-debugging-port:
```
cd ~/dev/btt-writer-ai
DISPLAY=:0 ./node_modules/.bin/electron src/js/main.js --no-sandbox --remote-debugging-port=9222 > /tmp/btt-debug.log 2>&1 &
```

Wait a few seconds, then confirm CDP is up:
```
curl -s http://localhost:9222/json
```

You should see a JSON response with "title": "BTT Writer" and a webSocketDebuggerUrl.


## Run the simple smoke test script

Use the checked-in script (no application code changes needed):

```
node scripts/e2e/btt-first-run-smoke.mjs
```

Optional environment variables:

```
BTT_CDP_HOST=127.0.0.1
BTT_CDP_PORT=9222
```

What this script covers:
- Clicks top-right add button
- Selects `Ari`
- Selects `New Testament`
- Selects `Philemon` (with scrolling)
- Opens resources, selects `Unlocked Literal Bible`, clicks `Confirm`

Expected output ends with:

```
[smoke] PASS: project creation completed.
```

## Run chunk reference navigation separately

After project creation opens the translation workspace:

```
node scripts/e2e/btt-scroll-chunk-ref.mjs
```

Optional environment variable:

```
BTT_CHUNK_REF="Philemon 1:14–16"
```

Expected output ends with:

```
[chunk-nav] PASS: chunk reference is in view.
```

