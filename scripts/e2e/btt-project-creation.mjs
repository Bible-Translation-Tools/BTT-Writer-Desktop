#!/usr/bin/env node

// Smoke test for BTT Writer project creation via CDP.
// Keeps application code untouched and runs externally.

const CDP_HOST = process.env.BTT_CDP_HOST || "127.0.0.1";
const CDP_PORT = Number(process.env.BTT_CDP_PORT || "9222");
const STEP_SETTLE_MS = Number(process.env.BTT_STEP_SETTLE_MS || "700");
const DIALOG_SETTLE_MS = Number(process.env.BTT_DIALOG_SETTLE_MS || "1200");

if (typeof fetch !== "function") {
  throw new Error("Global fetch is required. Run with Node 20+.");
}

if (typeof WebSocket !== "function") {
  throw new Error("Global WebSocket is required. Run with Node 20+.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printStep(name, result) {
  console.log(`[smoke] ${name}: ${result}`);
}

function escapeForTemplate(str) {
  return JSON.stringify(str);
}

function clickByTextExpr(text) {
  const target = escapeForTemplate(text);
  return `
    (function () {
      function collect(root, out) {
        for (const el of root.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (visible && (el.textContent || "").trim() === ${target}) out.push(el);
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
      }
      const out = [];
      collect(document, out);
      if (!out.length) return "NOT_FOUND";
      out[0].click();
      return "CLICKED";
    })()
  `;
}

function hasVisibleTextExpr(text) {
  const target = escapeForTemplate(text);
  return `
    (function () {
      function collect(root, out) {
        for (const el of root.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (visible && (el.textContent || "").trim() === ${target}) out.push(el);
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
      }
      const out = [];
      collect(document, out);
      return out.length > 0 ? "FOUND" : "NOT_FOUND";
    })()
  `;
}

function clickCenterAddButtonExpr() {
  return `
    (function () {
      function collect(root, out) {
        for (const el of root.querySelectorAll("iron-icon, img")) {
          const rect = el.getBoundingClientRect();
          if (
            rect.width >= 80 &&
            rect.height >= 80 &&
            rect.width <= 200 &&
            rect.height <= 200
          ) {
            out.push(el);
          }
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
      }
      const out = [];
      collect(document, out);
      if (!out.length) return "NOT_FOUND";
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      let best = out[0];
      let bestDistance = Infinity;
      for (const el of out) {
        const rect = el.getBoundingClientRect();
        const distance = Math.hypot(
          rect.left + rect.width / 2 - cx,
          rect.top + rect.height / 2 - cy
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          best = el;
        }
      }
      best.click();
      return "CLICKED";
    })()
  `;
}

function clickTopRightNewProjectFabExpr() {
  return `
    (function () {
      function collect(root, out) {
        for (const el of root.querySelectorAll("paper-fab[icon='add']")) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) out.push(el);
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
      }

      const out = [];
      collect(document, out);
      if (!out.length) return "NOT_FOUND";

      // Choose the add button nearest the top-right corner.
      let best = out[0];
      let bestDistance = Infinity;
      for (const el of out) {
        const rect = el.getBoundingClientRect();
        const dx = window.innerWidth - (rect.left + rect.width / 2);
        const dy = rect.top + rect.height / 2;
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = el;
        }
      }

      best.click();
      return "CLICKED";
    })()
  `;
}

async function getCdpTarget() {
  const url = `http://${CDP_HOST}:${CDP_PORT}/json`;
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

async function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return ws;
}

function createRuntime(ws) {
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

async function waitForClick(evaluate, text, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(clickByTextExpr(text));
    if (result === "CLICKED") return;
    await sleep(300);
  }
  throw new Error(`Timed out waiting to click text: ${text}`);
}

async function waitForTextVisible(evaluate, text, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(hasVisibleTextExpr(text));
    if (result === "FOUND") return;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for text to appear: ${text}`);
}

function selectUlbResourceExpr() {
  return `
    (function () {
      function collectText(root, needle, out) {
        for (const el of root.querySelectorAll("*")) {
          const text = (el.textContent || "").trim();
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && text.includes(needle)) out.push(el);
          if (el.shadowRoot) collectText(el.shadowRoot, needle, out);
        }
      }
      function collectCheckboxes(root, out) {
        for (const el of root.querySelectorAll('paper-checkbox, input[type="checkbox"]')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) out.push(el);
          if (el.shadowRoot) collectCheckboxes(el.shadowRoot, out);
        }
      }
      const rows = [];
      collectText(document, "Unlocked Literal Bible", rows);
      if (!rows.length) return "NOT_FOUND";
      rows.sort((a, b) => a.textContent.trim().length - b.textContent.trim().length);
      const rowRect = rows[0].getBoundingClientRect();

      const checkboxes = [];
      collectCheckboxes(document, checkboxes);
      let best = null;
      let bestDistance = Infinity;
      for (const cb of checkboxes) {
        const rect = cb.getBoundingClientRect();
        const deltaY = Math.abs(
          rect.top + rect.height / 2 - (rowRect.top + rowRect.height / 2)
        );
        if (deltaY < bestDistance) {
          bestDistance = deltaY;
          best = cb;
        }
      }

      if (!best) {
        rows[0].click();
        return "CLICKED";
      }

      best.click();
      return "CLICKED";
    })()
  `;
}

function clickBookInListExpr(bookName) {
  const target = escapeForTemplate(bookName);
  return `
    (function () {
      function collectVisibleExactText(root, text, out) {
        for (const el of root.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (visible && (el.textContent || "").trim() === text) out.push(el);
          if (el.shadowRoot) collectVisibleExactText(el.shadowRoot, text, out);
        }
      }

      function findScrollableIronList(root) {
        const lists = root.querySelectorAll("iron-list#list, iron-list");
        for (const list of lists) {
          if (list.scrollHeight > list.clientHeight) return list;
        }
        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findScrollableIronList(el.shadowRoot);
          if (nested) return nested;
        }
        return null;
      }

      const matches = [];
      collectVisibleExactText(document, ${target}, matches);
      if (matches.length) {
        matches[0].click();
        return "CLICKED";
      }

      const list = findScrollableIronList(document);
      if (!list) return "NOT_FOUND";

      const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
      if (list.scrollTop >= maxTop - 2) return "END";

      list.scrollTop = Math.min(maxTop, list.scrollTop + Math.max(120, list.clientHeight * 0.8));
      return "SCROLLED";
    })()
  `;
}

async function waitForEvalResult(evaluate, expressionFactory, expected = "CLICKED", timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(expressionFactory());
    if (result === expected) return;
    await sleep(300);
  }
  throw new Error("Timed out waiting for project creation interaction.");
}

async function waitForBookClickWithScroll(evaluate, bookName, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(clickBookInListExpr(bookName));
    if (result === "CLICKED") return;
    if (result === "END") {
      throw new Error(`Reached end of book list before finding: ${bookName}`);
    }
    await sleep(300);
  }
  throw new Error(`Timed out trying to find/click book: ${bookName}`);
}

async function run() {
  const target = await getCdpTarget();
  printStep("target", `${target.title || "unknown"} (${target.type})`);

  const ws = await connectCdp(target.webSocketDebuggerUrl);
  const { send, evaluate } = createRuntime(ws);

  try {
    await send("Runtime.enable");

    await waitForEvalResult(evaluate, clickTopRightNewProjectFabExpr);
    printStep("start-project", "top-right add button");
    await sleep(STEP_SETTLE_MS);

    await waitForTextVisible(evaluate, "Ari", 20000);
    await waitForClick(evaluate, "Ari");
    printStep("language", "Ari");
    await sleep(STEP_SETTLE_MS);

    await waitForTextVisible(evaluate, "New Testament", 20000);
    await waitForClick(evaluate, "New Testament");
    printStep("testament", "New Testament");
    await sleep(STEP_SETTLE_MS);

    await waitForBookClickWithScroll(evaluate, "Philemon", 30000);
    printStep("book", "Philemon");
    await sleep(DIALOG_SETTLE_MS);

    await waitForEvalResult(evaluate, clickCenterAddButtonExpr, "CLICKED", 20000);
    printStep("open-resources", "ok");
    await sleep(DIALOG_SETTLE_MS);

    await waitForEvalResult(evaluate, selectUlbResourceExpr, "CLICKED", 20000);
    printStep("resource-select", "Unlocked Literal Bible");
    await sleep(DIALOG_SETTLE_MS);

    await waitForTextVisible(evaluate, "Confirm", 20000);
    await waitForClick(evaluate, "Confirm");
    printStep("confirm", "ok");

    console.log("[smoke] PASS: project creation completed.");
  } finally {
    ws.close();
  }
}

run().catch((error) => {
  console.error(`[smoke] FAIL: ${error.message}`);
  process.exitCode = 1;
});
