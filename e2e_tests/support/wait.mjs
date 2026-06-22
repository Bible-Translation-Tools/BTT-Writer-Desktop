import { isCdpDisconnectError, openCdpEvaluateSession } from "./cdp-runtime.mjs";
import {
  clickByTextExprCollectFirst,
  hasVisibleTextExpr,
} from "../expressions/shadow-click.mjs";
import { clickBookInListExpr } from "../expressions/project-wizard.mjs";
import {
  findVerseMarkerInChunkExpr,
  scrollToChunkRefExpr,
  textboxContainsExpr,
} from "../expressions/review.mjs";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function evalState(result) {
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && "state" in result) {
    return result.state ?? "UNKNOWN";
  }
  return "UNKNOWN";
}

/**
 * Polls until `isDone(state)` returns true; `state` is derived via `evalState`.
 * @returns {string|*} final raw result when done (last evaluated value)
 */
export async function waitForEvalState(
  evaluate,
  expressionFactory,
  isDone,
  timeoutMs,
  failureMessage,
  { intervalMs = 250 } = {}
) {
  const start = Date.now();
  let lastState = "UNKNOWN";
  let lastResult;
  while (Date.now() - start < timeoutMs) {
    lastResult = await evaluate(expressionFactory());
    const state = evalState(lastResult);
    lastState = state;
    if (isDone(state, lastResult)) return lastResult;
    await sleep(intervalMs);
  }
  throw new Error(`${failureMessage} (last state: ${lastState})`);
}

export async function waitForEvalExact(
  evaluate,
  expressionFactory,
  expectedState,
  timeoutMs,
  failureMessage,
  { intervalMs = 250 } = {}
) {
  await waitForEvalState(
    evaluate,
    expressionFactory,
    (state) => state === expectedState,
    timeoutMs,
    failureMessage,
    { intervalMs }
  );
}

/**
 * Like waitForEvalState, but reconnects CDP once if the socket drops (e.g. app reload).
 */
export async function waitForEvalStateWithReconnect(
  evaluate,
  expressionFactory,
  isDone,
  timeoutMs,
  failureMessage,
  { intervalMs = 500 } = {}
) {
  const start = Date.now();
  let currentEvaluate = evaluate;
  let lastState = "UNKNOWN";
  let reconnectedSession = null;

  try {
    while (Date.now() - start < timeoutMs) {
      try {
        const result = await currentEvaluate(expressionFactory());
        const state = evalState(result);
        lastState = state;
        if (isDone(state, result)) return result;
      } catch (err) {
        if (!isCdpDisconnectError(err) || reconnectedSession) {
          throw err;
        }
        reconnectedSession = await openCdpEvaluateSession();
        currentEvaluate = reconnectedSession.evaluate;
        continue;
      }
      await sleep(intervalMs);
    }
    throw new Error(`${failureMessage} (last state: ${lastState})`);
  } finally {
    if (reconnectedSession) {
      await reconnectedSession.close();
    }
  }
}

/** Strict string equality polling (project creation style, 300ms interval). */
export async function waitForEvalResult(
  evaluate,
  expressionFactory,
  expected = "CLICKED",
  timeoutMs = 12000,
  failureMessage = "Timed out waiting for CDP expression result."
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(expressionFactory());
    if (result === expected) return;
    await sleep(300);
  }
  throw new Error(failureMessage);
}

export async function waitForClick(evaluate, text, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(clickByTextExprCollectFirst(text));
    if (result === "CLICKED") return;
    await sleep(300);
  }
  throw new Error(`Timed out waiting to click text: ${text}`);
}

export async function waitForTextVisible(evaluate, text, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(hasVisibleTextExpr(text));
    if (result === "FOUND") return;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for text to appear: ${text}`);
}

export async function waitForBookClickWithScroll(evaluate, bookName, timeoutMs = 30000) {
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

export async function waitForChunkRefVisibleWithScroll(
  evaluate,
  chunkRef,
  timeoutMs = 10000,
  { intervalMs = 300 } = {}
) {
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
    await sleep(intervalMs);
  }
  throw new Error(`Timed out trying to scroll to chunk ref: ${chunkRef} (last state: ${lastState})`);
}

export async function waitForTextboxContains(evaluate, value, timeoutMs = 10000) {
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

export async function waitForVerseMarkerInChunk(
  evaluate,
  chunkRef,
  verseNumber,
  timeoutMs = 10000
) {
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
