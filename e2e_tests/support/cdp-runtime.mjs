/**
 * Shared Chrome DevTools Protocol helpers for attaching to a running Electron/Chromium
 * instance (--remote-debugging-port).
 */

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

export function createRuntime(ws) {
  let msgId = 0;

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++msgId;
      const onMessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id !== id) return;
        ws.removeEventListener("message", onMessage);
        if (data.error) {
          reject(new Error(`${method} failed: ${JSON.stringify(data.error)}`));
          return;
        }
        resolve(data.result);
      };
      ws.addEventListener("message", onMessage);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return result?.result?.value;
  };

  return { send, evaluate };
}

/**
 * Connects to the preferred BTT page target, enables Runtime, runs `fn`, then closes the socket.
 */
export async function withCdpSession(fn, config = loadCdpConfig()) {
  assertCdpGlobals();
  const target = await getCdpTarget(config);
  const ws = await connectCdp(target.webSocketDebuggerUrl);
  const { send, evaluate } = createRuntime(ws);
  try {
    await send("Runtime.enable");
    return await fn({ evaluate, send, target });
  } finally {
    ws.close();
  }
}
