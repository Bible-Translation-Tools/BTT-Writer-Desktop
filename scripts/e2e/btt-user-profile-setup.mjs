#!/usr/bin/env node

// Smoke utility: set up local user profile via CDP.

const CDP_HOST = process.env.BTT_CDP_HOST || "127.0.0.1";
const CDP_PORT = Number(process.env.BTT_CDP_PORT || "9222");
const PROFILE_NAME = process.env.BTT_PROFILE_NAME || "Tony (AI)";

if (typeof fetch !== "function") {
  throw new Error("Global fetch is required. Run with Node 20+.");
}

if (typeof WebSocket !== "function") {
  throw new Error("Global WebSocket is required. Run with Node 20+.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printStep(name, result) {
  console.log(`[profile-setup] ${name}: ${result}`);
}

function escapeForTemplate(str) {
  return JSON.stringify(str);
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

function clickByTextExpr(text) {
  const target = escapeForTemplate(text);
  return `
    (function () {
      function clickInRoot(root) {
        for (const el of root.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (visible && (el.textContent || "").trim() === ${target}) {
            el.click();
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

/** Matches i18n key \`local_user_prompt\` across shipped locales (see i18n/*.json). */
const PROFILE_NAME_PLACEHOLDERS = new Set([
  "Full Name or Pseudonym",
  "Nombre Completo o Apodo",
  "Nom Complet ou Pseudonyme",
  "Nome Completo ou Pseudônimo",
  "Полное имя или псевдоним",
  "نام کامل یا مستعار",
]);

function setProfileNameExpr(name) {
  const target = escapeForTemplate(name);
  const placeholdersJson = JSON.stringify([...PROFILE_NAME_PLACEHOLDERS]);
  return `
    (function () {
      var PLACEHOLDERS = new Set(${placeholdersJson});

      function isProfileNameField(node) {
        if (!node || node.tagName !== "INPUT") return false;
        if (node.type === "password" || node.type === "hidden" || node.type === "submit") return false;
        return PLACEHOLDERS.has(node.placeholder || "");
      }

      function collectInputs(root, out) {
        Array.prototype.forEach.call(root.querySelectorAll("input"), function (node) {
          if (isProfileNameField(node)) out.push(node);
        });
        Array.prototype.forEach.call(root.querySelectorAll("*"), function (el) {
          if (el.shadowRoot) collectInputs(el.shadowRoot, out);
        });
      }

      function pickBest(candidates) {
        function visibleEnough(node) {
          try {
            node.scrollIntoView({ block: "center", inline: "nearest" });
          } catch (e) {}
          var r = node.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }
        for (var i = 0; i < candidates.length; i++) {
          if (visibleEnough(candidates[i])) return candidates[i];
        }
        return candidates.length ? candidates[0] : null;
      }

      var found = [];
      collectInputs(document, found);
      var input = pickBest(found);
      if (!input) return "NOT_FOUND";

      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      setter = setter && setter.set;
      if (!setter) return "SETTER_NOT_FOUND";

      setter.call(input, ${target});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return "SET:" + input.value;
    })()
  `;
}

async function waitForEvalState(evaluate, expressionFactory, isDone, timeoutMs, failureMessage) {
  const start = Date.now();
  let lastState = "UNKNOWN";
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(expressionFactory());
    const state = typeof result === "string" ? result : result?.state || "UNKNOWN";
    lastState = state;
    if (isDone(state)) return state;
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

    const step1 = await waitForEvalState(
      evaluate,
      () => clickByTextExpr("Create Local User Profile"),
      (state) => state === "CLICKED",
      5000,
      "Failed to click Create Local User Profile"
    );
    printStep("step-1-create-local-profile", step1);
    await sleep(1500);

    const step2 = await waitForEvalState(
      evaluate,
      () => setProfileNameExpr(PROFILE_NAME),
      (state) => state.startsWith("SET:"),
      5000,
      "Failed to set profile name input"
    );
    printStep("step-2-enter-username", step2);
    await sleep(500);

    const step3 = await waitForEvalState(
      evaluate,
      () => clickByTextExpr("OK"),
      (state) => state === "CLICKED",
      5000,
      "Failed to click OK"
    );
    printStep("step-3-ok", step3);
    await sleep(1500);

    const step4 = await waitForEvalState(
      evaluate,
      () => clickByTextExpr("I Agree"),
      (state) => state === "CLICKED",
      5000,
      "Failed to click I Agree"
    );
    printStep("step-4-i-agree", step4);
    await sleep(1500);

    console.log("[profile-setup] PASS: local user profile setup completed.");
  } finally {
    ws.close();
  }
}

run().catch((error) => {
  console.error(`[profile-setup] FAIL: ${error.message}`);
  process.exitCode = 1;
});
