/**
 * Shared Chrome DevTools Protocol helpers for attaching to a running Electron/Chromium
 * instance (--remote-debugging-port).
 */

const DEFAULT_SEND_TIMEOUT_MS = 10000;

export function assertCdpGlobals() {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is required. Run with Node 20+.");
  }
  if (typeof WebSocket !== "function") {
    throw new Error("Global WebSocket is required. Run with Node 20+.");
  }
}

export function loadCdpConfig(overrides = {}) {
  return {
    host: overrides.host ?? process.env.BTT_CDP_HOST ?? "127.0.0.1",
    port: Number(overrides.port ?? process.env.BTT_CDP_PORT ?? "9222"),
  };
}

export async function getCdpTarget(config = loadCdpConfig()) {
  const url = `http://${config.host}:${config.port}/json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CDP endpoint unavailable: ${url} (${response.status})`);
  }

  const targets = await response.json();
  if (!Array.isArray(targets) || !targets.length) {
    throw new Error(`No CDP targets available at ${url}`);
  }

  const preferred = targets.find(
    (t) => t.type === "page" && typeof t.title === "string" && t.title.includes("BTT")
  );
  const fallback = targets.find((t) => t.type === "page");
  const selected = preferred || fallback;

  if (!selected || !selected.webSocketDebuggerUrl) {
    throw new Error("Could not find a page target with webSocketDebuggerUrl.");
  }

  return selected;
}

export async function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return ws;
}

/**
 * Poll until the CDP HTTP endpoint responds (Electron finished binding port 9222).
 */
export async function waitForCdpEndpoint(
  config = loadCdpConfig(),
  { timeoutMs = 120_000, intervalMs = 500 } = {}
) {
  const versionUrl = `http://${config.host}:${config.port}/json/version`;
  const start = Date.now();
  let lastError = "unknown";

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(versionUrl);
      if (response.ok) {
        return;
      }
      lastError = `${versionUrl} (${response.status})`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`CDP endpoint not ready after ${timeoutMs}ms: ${lastError}`);
}

export function createRuntime(ws) {
  let msgId = 0;
  /** @type {Map<number, { reject: (err: Error) => void, cleanup: () => void }>} */
  const pending = new Map();

  const rejectAll = (err) => {
    for (const { reject, cleanup } of pending.values()) {
      cleanup();
      reject(err);
    }
    pending.clear();
  };

  ws.addEventListener("close", () => {
    rejectAll(new Error("CDP WebSocket closed"));
  });

  ws.addEventListener("error", () => {
    rejectAll(new Error("CDP WebSocket error"));
  });

  const send = (method, params = {}, { timeoutMs = DEFAULT_SEND_TIMEOUT_MS } = {}) =>
    new Promise((resolve, reject) => {
      const id = ++msgId;

      const cleanup = () => {
        clearTimeout(timer);
        pending.delete(id);
        ws.removeEventListener("message", onMessage);
      };

      const onMessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id !== id) return;
        cleanup();
        if (data.error) {
          reject(new Error(`${method} failed: ${JSON.stringify(data.error)}`));
          return;
        }
        resolve(data.result);
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      pending.set(id, {
        reject: (err) => {
          cleanup();
          reject(err);
        },
        cleanup,
      });

      ws.addEventListener("message", onMessage);
      try {
        ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        cleanup();
        pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return result?.result?.value;
  };

  const close = async () => {
    rejectAll(new Error("CDP session closed"));
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  };

  return { send, evaluate, close };
}

function isBenignCloseError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return /closed|closing|ECONNRESET|WebSocket is already|session closed/i.test(message);
}

/**
 * Quits the Electron app via CDP Browser.close (requires --remote-debugging-port).
 * Uses the browser debugger WebSocket from /json/version (not the page target used by tests).
 * Browser.close tears down immediately; a dropped socket before the CDP reply is OK.
 */
export async function closeAppViaCdp(config = loadCdpConfig()) {
  assertCdpGlobals();
  const versionUrl = `http://${config.host}:${config.port}/json/version`;
  const response = await fetch(versionUrl);
  if (!response.ok) {
    throw new Error(`CDP version endpoint unavailable: ${versionUrl} (${response.status})`);
  }

  const version = await response.json();
  if (!version?.webSocketDebuggerUrl) {
    throw new Error("CDP version response missing webSocketDebuggerUrl.");
  }

  const ws = await connectCdp(version.webSocketDebuggerUrl);
  const { send, close } = createRuntime(ws);
  try {
    await send("Browser.close");
  } catch (err) {
    if (!isBenignCloseError(err)) throw err;
  } finally {
    await close();
  }
}

/**
 * Connects to the preferred BTT page target, enables Runtime, runs `fn`, then closes the socket.
 */
export async function withCdpSession(fn, config = loadCdpConfig()) {
  assertCdpGlobals();
  const target = await getCdpTarget(config);
  const ws = await connectCdp(target.webSocketDebuggerUrl);
  const { send, evaluate, close } = createRuntime(ws);
  try {
    await send("Runtime.enable");
    return await fn({ evaluate, send, target, close });
  } finally {
    await close();
  }
}
