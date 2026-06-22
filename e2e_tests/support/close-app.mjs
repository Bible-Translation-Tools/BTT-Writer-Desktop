#!/usr/bin/env node

import { closeAppViaCdp } from "./cdp-runtime.mjs";

async function main() {
  await closeAppViaCdp();
  console.log("[close-app] Electron app closed via CDP.");
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[close-app] Failed to close app: ${message}`);
  process.exit(1);
});
