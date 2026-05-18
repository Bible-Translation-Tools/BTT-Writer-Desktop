#!/usr/bin/env node

// Smoke utility: open sidebar menu and navigate Upload/Export via CDP.

const CDP_HOST = process.env.BTT_CDP_HOST || "127.0.0.1";
const CDP_PORT = Number(process.env.BTT_CDP_PORT || "9222");
const STEP_SETTLE_MS = Number(process.env.BTT_STEP_SETTLE_MS || "1500");

if (typeof fetch !== "function") {
  throw new Error("Global fetch is required. Run with Node 20+.");
}

if (typeof WebSocket !== "function") {
  throw new Error("Global WebSocket is required. Run with Node 20+.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printStep(name, result) {
  console.log(`[menu-export] ${name}: ${result}`);
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
    (target) =>
      target.type === "page" && typeof target.title === "string" && target.title.includes("BTT")
  );
  const fallback = targets.find((target) => target.type === "page");
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

function clickMenuIconExpr() {
  return `
    (function () {
      function clickInRoot(root) {
        const menuButton = root.querySelector("paper-menu-button#menu");
        if (menuButton) {
          if (typeof menuButton.open === "function") {
            menuButton.open();
            return "CLICKED";
          }
          if (typeof menuButton.toggle === "function") {
            menuButton.toggle();
            return "CLICKED";
          }
          menuButton.click();
          return "CLICKED";
        }

        const icon = root.querySelector("#menuicon, iron-icon.dropdown-trigger");
        if (icon) {
          const rect = icon.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const trigger = icon.closest("paper-menu-button") || icon;
            trigger.click();
            return "CLICKED";
          }
          return "NOT_VISIBLE";
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = clickInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return clickInRoot(document);
    })()
  `;
}

function clickExportMenuItemExpr() {
  return `
    (function () {
      function clickInRoot(root) {
        const item = root.querySelector("paper-item[on-tap='goexport']");
        if (item) {
          item.click();
          return "CLICKED";
        }

        const exportIcon = root.querySelector("paper-item iron-icon[icon='file-upload']");
        if (exportIcon) {
          const parentItem = exportIcon.closest("paper-item");
          if (parentItem) {
            parentItem.click();
            return "CLICKED";
          }
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = clickInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return clickInRoot(document);
    })()
  `;
}

function clickExportToUsfmExpr() {
  return `
    (function () {
      function triggerTapLikeClick(node) {
        const init = { bubbles: true, cancelable: true, composed: true, view: window };
        node.dispatchEvent(new MouseEvent("mousedown", init));
        node.dispatchEvent(new MouseEvent("mouseup", init));
        node.dispatchEvent(new MouseEvent("click", init));
        node.dispatchEvent(new CustomEvent("tap", { bubbles: true, cancelable: true, composed: true }));
      }

      function clickInRoot(root) {
        const dialogs = root.querySelectorAll("ts-export-options");
        for (const dialog of dialogs) {
          const dialogRect = dialog.getBoundingClientRect();
          if (dialogRect.width <= 0 || dialogRect.height <= 0) continue;

          const labels = dialog.querySelectorAll("div[on-tap='checkusfm'] span.optiontitle");
          for (const label of labels) {
            const option = label.closest("div[on-tap='checkusfm']");
            if (!option) continue;
            const optionClass = option.getAttribute("class") || "";
            if (optionClass.includes("hide")) continue;

            const labelText = (label.childNodes?.[0]?.textContent || label.textContent || "")
              .replace(/\\s+/g, " ")
              .trim();
            if (labelText !== "Export to USFM") continue;

            const rect = label.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            triggerTapLikeClick(label);
            return "CLICKED";
          }
        }

        // Fallback: keep strict text match but outside dialog scoping.
        const textFallback = root.querySelectorAll("span.optiontitle");
        for (const label of textFallback) {
          const text = (label.childNodes?.[0]?.textContent || label.textContent || "")
            .replace(/\\s+/g, " ")
            .trim();
          if (text !== "Export to USFM") continue;
          const rect = label.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          triggerTapLikeClick(label);
          return "CLICKED";
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = clickInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return clickInRoot(document);
    })()
  `;
}

async function waitForEvalState(evaluate, expressionFactory, expectedState, timeoutMs, failureMessage) {
  const start = Date.now();
  let lastState = "UNKNOWN";
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(expressionFactory());
    const state = typeof result === "string" ? result : result?.state || "UNKNOWN";
    lastState = state;
    if (state === expectedState) return;
    await sleep(250);
  }
  throw new Error(`${failureMessage} (last state: ${lastState})`);
}

async function run() {
  const target = await getCdpTarget();
  printStep("target", `${target.title || "unknown"} (${target.type})`);

  const ws = await connectCdp(target.webSocketDebuggerUrl);
  const { send, evaluate } = createRuntime(ws);

  try {
    await send("Runtime.enable");

    await waitForEvalState(
      evaluate,
      clickMenuIconExpr,
      "CLICKED",
      15000,
      "Failed to click menu icon (#menuicon)"
    );
    printStep("menu-open", "clicked");
    await sleep(STEP_SETTLE_MS);

    await waitForEvalState(
      evaluate,
      clickExportMenuItemExpr,
      "CLICKED",
      15000,
      "Failed to click Upload/Export menu item (paper-item[on-tap='goexport'])"
    );
    printStep("upload-export", "clicked");
    await sleep(STEP_SETTLE_MS);

    await waitForEvalState(
      evaluate,
      clickExportToUsfmExpr,
      "CLICKED",
      15000,
      "Failed to click Export to USFM option (div[on-tap='checkusfm'])"
    );
    printStep("export-to-usfm", "clicked");

    console.log("[menu-export] PASS: opened menu, clicked Upload/Export, and selected Export to USFM.");
  } finally {
    ws.close();
  }
}

run().catch((error) => {
  console.error(`[menu-export] FAIL: ${error.message}`);
  process.exitCode = 1;
});