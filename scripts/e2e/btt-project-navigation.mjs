#!/usr/bin/env node

// Smoke utility: scroll to a target chunk reference in review mode via CDP.
// Run this after the project is already opened in translation workspace.

const CDP_HOST = process.env.BTT_CDP_HOST || "127.0.0.1";
const CDP_PORT = Number(process.env.BTT_CDP_PORT || "9222");
const CHUNK_REF = process.env.BTT_CHUNK_REF || "Philemon 1:14–16";
const EDIT_TEXT = "\\v 14 Nhưng tôi không muốn làm bất cứ điều gì mà không có sự ưng thuận của anh. Tôi làm điều này để bất kỳ việc tốt nào được thực hiện đều không phải do tôi ép buộc anh, nhưng vì anh muốn làm điều đó. \\v 15 Có lẽ lý do cậu ấy bị chia cắt khỏi anh trong một khoảng thời gian, là để anh có thể có lại cậu ấy mãi mãi. \\v 16 Để cậu ta không còn như một nô lệ nữa, nhưng còn hơn cả một nô lệ, như là một anh em yêu dấu, đặc biệt là với tôi và sẽ càng yêu dấu cho anh hơn nữa, cả trong xác thịt lẫn trong Chúa.";

if (typeof fetch !== "function") {
  throw new Error("Global fetch is required. Run with Node 20+.");
}

if (typeof WebSocket !== "function") {
  throw new Error("Global WebSocket is required. Run with Node 20+.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printStep(name, result) {
  console.log(`[chunk-nav] ${name}: ${result}`);
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

function scrollToChunkRefExpr(chunkRef) {
  const target = escapeForTemplate(chunkRef);
  return `
    (function () {
      function normalizeRef(text) {
        return (text || "")
          .replace(/[\\u2010-\\u2015]/g, "-")
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      const wanted = normalizeRef(${target});

      function findVisibleReviewList() {
        const lists = Array.from(document.querySelectorAll("iron-list#reviewlist"));
        for (const list of lists) {
          const rect = list.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (!visible) continue;
          const modeHost = list.closest("ts-review-mode");
          if (modeHost && modeHost.classList.contains("hide")) continue;
          return list;
        }
        return null;
      }

      function findChunkRefInReviewList(reviewList) {
        const cards = reviewList.querySelectorAll("ts-review-card");
        for (const card of cards) {
          const review = card.querySelector("ts-target-review");
          if (!review) continue;
          const heading = review.querySelector("#heading");
          if (!heading) continue;
          const spans = heading.querySelectorAll("span");
          if (!spans.length) continue;
          const headingText = Array.from(spans).map((s) => s.textContent || "").join("");
          const normalized = normalizeRef(headingText);
          if (normalized === wanted || normalized.includes(wanted)) return heading;
        }
        return null;
      }

      const reviewList = findVisibleReviewList();
      if (!reviewList) {
        return { state: "NO_REVIEW_LIST" };
      }

      const match = findChunkRefInReviewList(reviewList);
      if (match) {
        match.scrollIntoView({ block: "center", behavior: "instant" });
        return {
          state: "FOUND",
          listTop: reviewList.scrollTop,
          firstVisibleIndex: reviewList.firstVisibleIndex || 0,
          lastVisibleIndex: reviewList.lastVisibleIndex || 0
        };
      }

      const before = reviewList.scrollTop;
      const maxTop = Math.max(0, reviewList.scrollHeight - reviewList.clientHeight);
      if (before >= maxTop - 2) {
        return {
          state: "END",
          listTop: before,
          maxTop: maxTop,
          firstVisibleIndex: reviewList.firstVisibleIndex || 0,
          lastVisibleIndex: reviewList.lastVisibleIndex || 0
        };
      }

      reviewList.scrollTop = Math.min(
        maxTop,
        before + Math.max(220, reviewList.clientHeight * 0.8)
      );
      return {
        state: "SCROLLED",
        listTopBefore: before,
        listTopAfter: reviewList.scrollTop,
        maxTop: maxTop,
        firstVisibleIndex: reviewList.firstVisibleIndex || 0,
        lastVisibleIndex: reviewList.lastVisibleIndex || 0
      };
    })()
  `;
}

function findVerseMarkerInChunkExpr(chunkRef, verseNumber) {
  const target = escapeForTemplate(chunkRef);
  const verse = escapeForTemplate(String(verseNumber));
  return `
    (function () {
      function normalizeRef(text) {
        return (text || "")
          .replace(/[\\u2010-\\u2015]/g, "-")
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      const wanted = normalizeRef(${target});
      const wantedVerse = String(${verse}).trim();
      const reviewList = document.querySelector("iron-list#reviewlist");
      if (!reviewList) return "NO_REVIEW_LIST";

      const cards = reviewList.querySelectorAll("ts-review-card");
      for (const card of cards) {
        const review = card.querySelector("ts-target-review");
        if (!review) continue;
        const heading = review.querySelector("#heading");
        if (!heading) continue;
        const spans = heading.querySelectorAll("span");
        if (!spans.length) continue;
        const headingText = Array.from(spans).map((s) => s.textContent || "").join("");
        const normalized = normalizeRef(headingText);
        if (!(normalized === wanted || normalized.includes(wanted))) continue;

        const candidates = review.querySelectorAll("ts-verse-marker #num, div#num.style-scope.ts-verse-marker, #num");
        for (const node of candidates) {
          const rect = node.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          if ((node.textContent || "").trim() === wantedVerse) {
            node.scrollIntoView({ block: "center", behavior: "instant" });
            return "FOUND";
          }
        }
        return "VERSE_NOT_FOUND_IN_CHUNK";
      }

      return "CHUNK_NOT_VISIBLE";
    })()
  `;
}

function clickEditIconForChunkExpr(chunkRef) {
  const target = escapeForTemplate(chunkRef);
  return `
    (function () {
      function normalizeRef(text) {
        return (text || "")
          .replace(/[\\u2010-\\u2015]/g, "-")
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      const wanted = normalizeRef(${target});
      const reviewList = document.querySelector("iron-list#reviewlist");
      if (!reviewList) return "NO_REVIEW_LIST";

      const cards = reviewList.querySelectorAll("ts-review-card");
      for (const card of cards) {
        const review = card.querySelector("ts-target-review");
        if (!review) continue;
        const heading = review.querySelector("#heading");
        if (!heading) continue;
        const spans = heading.querySelectorAll("span");
        if (!spans.length) continue;
        const headingText = Array.from(spans).map((s) => s.textContent || "").join("");
        const normalized = normalizeRef(headingText);
        if (!(normalized === wanted || normalized.includes(wanted))) continue;

        const icon = review.querySelector("iron-icon[icon='create']");
        if (!icon) return "NO_EDIT_ICON";
        const rect = icon.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return "NO_EDIT_ICON";
        icon.click();
        return "CLICKED";
      }

      return "NOT_FOUND";
    })()
  `;
}


function setTextboxValueExpr(value) {
  const target = escapeForTemplate(value);
  return `
    (function () {
      function escapeHtml(str) {
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }

      const candidates = Array.from(
        document.querySelectorAll("ts-target-edit #textbox[contenteditable='true']")
      );
      if (!candidates.length) return "NOT_FOUND";

      const textbox = candidates.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!textbox) return "NOT_VISIBLE";

      const newValue = (${target}).trim();
      const newHtml = escapeHtml(newValue);
      const currentHtml = (textbox.innerHTML || "").trim();
      if (currentHtml === newHtml) return "SET";

      textbox.focus();

      // Replace the textbox content with the new value (escaped)
      textbox.innerHTML = newHtml;

      textbox.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: newValue,
        inputType: "insertText"
      }));
      textbox.dispatchEvent(new Event("change", { bubbles: true }));
      textbox.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      return "SET";
    })()
  `;
}

function textboxContainsExpr(value) {
  const target = escapeForTemplate(value);
  return `
    (function () {
      const candidates = Array.from(
        document.querySelectorAll("ts-target-edit #textbox[contenteditable='true']")
      );
      if (!candidates.length) return "NOT_FOUND";

      const textbox = candidates.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!textbox) return "NOT_VISIBLE";

      const normalizedCurrent = (textbox.textContent || "").replace(/\\s+/g, " ").trim();
      const normalizedTarget = (${target}).replace(/\\s+/g, " ").trim();
      return normalizedCurrent.includes(normalizedTarget) ? "MATCH" : "NO_MATCH";
    })()
  `;
}

function clickDoneIconExpr() {
  return `
    (function () {
      const icons = Array.from(document.querySelectorAll("ts-target-edit iron-icon[icon='done']"));
      if (!icons.length) return "NOT_FOUND";

      const doneIcon = icons.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!doneIcon) return "NOT_VISIBLE";

      doneIcon.click();
      return "CLICKED";
    })()
  `;
}

function clickMarkChunkDoneToggleExpr(chunkRef) {
  const target = escapeForTemplate(chunkRef);
  return `
    (function () {
      function normalizeRef(text) {
        return (text || "")
          .replace(/[\\u2010-\\u2015]/g, "-")
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      const wanted = normalizeRef(${target});
      const reviewList = document.querySelector("iron-list#reviewlist");
      if (!reviewList) return "NO_REVIEW_LIST";

      const cards = reviewList.querySelectorAll("ts-review-card");
      for (const card of cards) {
        const review = card.querySelector("ts-target-review");
        if (!review) continue;
        const heading = review.querySelector("#heading");
        if (!heading) continue;
        const spans = heading.querySelectorAll("span");
        if (!spans.length) continue;
        const headingText = Array.from(spans).map((s) => s.textContent || "").join("");
        const normalized = normalizeRef(headingText);
        if (!(normalized === wanted || normalized.includes(wanted))) continue;

        const toggle = review.querySelector("paper-toggle-button#toggle");
        if (!toggle) return "NO_TOGGLE";
        const rect = toggle.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return "TOGGLE_NOT_VISIBLE";
        toggle.click();
        return "CLICKED";
      }

      return "CHUNK_NOT_VISIBLE";
    })()
  `;
}

function clickVisibleDialogConfirmExpr() {
  return `
    (function () {
      const buttons = Array.from(document.querySelectorAll("paper-button[dialog-confirm]"));
      if (!buttons.length) return "NOT_FOUND";

      const visible = buttons.find((btn) => {
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!visible) return "NOT_VISIBLE";

      visible.click();
      return "CLICKED";
    })()
  `;
}

// All timeouts capped to 10000ms (10s)
async function waitForChunkRefVisibleWithScroll(evaluate, chunkRef, timeoutMs = 10000) {
  const start = Date.now();
  let lastState = "UNKNOWN";
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(scrollToChunkRefExpr(chunkRef));
    const state = result?.state || "UNKNOWN";
    lastState = state;
    if (state === "FOUND") return;
    if (state === "END") {
      throw new Error(`Reached end of chunks before finding: ${chunkRef}`);
    }
    if (state === "NO_REVIEW_LIST") {
      throw new Error("Review list is not visible. Switch to Review mode first, then retry.");
    }
    await sleep(300);
  }
  throw new Error(`Timed out trying to scroll to chunk ref: ${chunkRef} (last state: ${lastState})`);
}

async function waitForEvalState(evaluate, expressionFactory, expectedState, timeoutMs = 10000, failureMessage) {
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

async function waitForTextboxContains(evaluate, value, timeoutMs = 10000) {
  const start = Date.now();
  let lastState = "UNKNOWN";
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(textboxContainsExpr(value));
    const state = typeof result === "string" ? result : "UNKNOWN";
    lastState = state;
    if (state === "MATCH") return;
    await sleep(250);
  }
  throw new Error(`Textbox did not contain expected text (last state: ${lastState})`);
}

async function waitForVerseMarkerInChunk(evaluate, chunkRef, verseNumber, timeoutMs = 10000) {
  const start = Date.now();
  let lastState = "UNKNOWN";
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(findVerseMarkerInChunkExpr(chunkRef, verseNumber));
    const state = typeof result === "string" ? result : "UNKNOWN";
    lastState = state;
    if (state === "FOUND") return;
    await sleep(250);
  }
  throw new Error(
    `Failed to find verse marker ${verseNumber} under chunk ${chunkRef} (last state: ${lastState})`
  );
}

async function run() {
  const target = await getCdpTarget();
  printStep("target", `${target.title || "unknown"} (${target.type})`);

  const ws = await connectCdp(target.webSocketDebuggerUrl);
  const { send, evaluate } = createRuntime(ws);

  try {
    await send("Runtime.enable");
    await waitForChunkRefVisibleWithScroll(evaluate, CHUNK_REF, 10000);
    printStep("chunk-ref", CHUNK_REF);
    await waitForEvalState(
      evaluate,
      () => clickEditIconForChunkExpr(CHUNK_REF),
      "CLICKED",
      10000,
      `Failed to click edit icon for chunk: ${CHUNK_REF}`
    );
    printStep("edit-icon", "clicked");
    await sleep(500);

    await waitForEvalState(
      evaluate,
      () => setTextboxValueExpr(EDIT_TEXT),
      "SET",
      10000,
      "Failed to set target edit textbox value"
    );
    await waitForTextboxContains(evaluate, EDIT_TEXT, 10000);
    printStep("textbox-input", EDIT_TEXT);

    await waitForEvalState(
      evaluate,
      clickDoneIconExpr,
      "CLICKED",
      10000,
      "Failed to click done icon"
    );
    printStep("done", "clicked");

    await waitForChunkRefVisibleWithScroll(evaluate, CHUNK_REF, 10000);
    await waitForVerseMarkerInChunk(evaluate, CHUNK_REF, 15, 10000);
    printStep("verse-marker", "15");
    await sleep(1000);

    await waitForEvalState(
      evaluate,
      () => clickMarkChunkDoneToggleExpr(CHUNK_REF),
      "CLICKED",
      10000,
      "Failed to click mark-chunk-done toggle"
    );
    printStep("mark-chunk-done", "clicked");

    await sleep(1000);

    await waitForEvalState(
      evaluate,
      clickVisibleDialogConfirmExpr,
      "CLICKED",
      10000,
      "Failed to click dialog confirm button"
    );
    printStep("dialog-confirm", "clicked");

    console.log("[chunk-nav] PASS: chunk navigation + edit + done + toggle + confirm completed.");
  } finally {
    ws.close();
  }
}

run().catch((error) => {
  console.error(`[chunk-nav] FAIL: ${error.message}`);
  process.exitCode = 1;
});
