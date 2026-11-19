/**
 * Regression: Up/Down typed in a chunk editor used to go to the review iron-list instead of the caret.
 * The list moved its focused item, the card being edited lost its re-use protection, and a jump that
 * scrolled the list made the pending save land in whatever chunk the card showed next.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { welcomeHomeVisibleExpr } from "../expressions/home.mjs";
import {
  chunkIdsContainingTextExpr,
  clickEditIconForChunkExpr,
  clickMenuIconExpr,
  clickTranslateSidebarHomeExpr,
  editorCaretStateExpr,
  focusTextboxAtStartExpr,
  setTextboxValueExpr,
  translateSidebarIconCenterExpr,
} from "../expressions/review.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import { clickAt, pressKey, typeText } from "../support/input.mjs";
import {
  sleep,
  waitForChunkRefVisibleWithScroll,
  waitForClick,
  waitForEvalExact,
  waitForEvalState,
  waitForTextboxContains,
} from "../support/wait.mjs";

const PROJECT_BOOK = "Philemon";
const CHUNK_REF = "Philemon 1:1–3";
const CHUNK_ID = "01-01";
// Long enough to wrap over several lines at any window width, so Down has somewhere to go on every OS.
const FILLER = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda ".repeat(4).trim();
const EDIT_TEXT = `\\v 1 ${FILLER} \\v 2 ${FILLER} \\v 3 ${FILLER}`;
const TYPED_MARKER = " KEYTEST ";
const WAIT_TIMEOUT_MS = 5000;
const PROJECT_LOAD_TIMEOUT_MS = 15000;
const SAVE_DEBOUNCE_SETTLE_MS = 1500;

function printStep(name, result) {
  console.log(`[chunk-edit-keys] ${name}: ${result}`);
}

describe("Chunk editor arrow keys", () => {
  test("Down moves the caret and a following jump keeps the edit in its own chunk", async () => {
    await withCdpSession(async ({ evaluate, send, target }) => {
      printStep("target", `${target.title || "unknown"} (${target.type})`);

      // The previous spec ends on the home screen; open the project from there.
      if ((await evaluate(welcomeHomeVisibleExpr())) === "VISIBLE") {
        await waitForClick(evaluate, PROJECT_BOOK, WAIT_TIMEOUT_MS);
        printStep("open-project", PROJECT_BOOK);
      }

      // A project re-opens at its last position and the chunk search only scrolls down: start from the top.
      const top = await waitForEvalState(
        evaluate,
        () => translateSidebarIconCenterExpr("first-page"),
        (state) => state === "FOUND",
        PROJECT_LOAD_TIMEOUT_MS,
        "Failed to find the sidebar first-page icon (project not open in review mode?)"
      );
      await sleep(1500);
      await clickAt(send, top.x, top.y);
      await sleep(1000);

      await waitForChunkRefVisibleWithScroll(evaluate, CHUNK_REF, WAIT_TIMEOUT_MS);
      printStep("chunk-ref", CHUNK_REF);

      await waitForEvalExact(
        evaluate,
        () => clickEditIconForChunkExpr(CHUNK_REF),
        "CLICKED",
        WAIT_TIMEOUT_MS,
        `Failed to click edit icon for chunk: ${CHUNK_REF}`
      );
      printStep("edit-icon", "clicked");
      await sleep(500);

      await waitForEvalExact(
        evaluate,
        () => setTextboxValueExpr(EDIT_TEXT),
        "SET",
        WAIT_TIMEOUT_MS,
        "Failed to set target edit textbox value"
      );
      await waitForTextboxContains(evaluate, EDIT_TEXT, WAIT_TIMEOUT_MS);
      printStep("textbox-input", `${EDIT_TEXT.length} chars`);
      await sleep(SAVE_DEBOUNCE_SETTLE_MS);

      await waitForEvalExact(
        evaluate,
        focusTextboxAtStartExpr,
        "FOCUSED",
        WAIT_TIMEOUT_MS,
        "Failed to focus the target edit textbox"
      );
      const before = await evaluate(editorCaretStateExpr());
      assert.equal(before.state, "OK");
      assert.equal(before.textboxFocused, true, "Editor textbox must have focus before pressing Down");
      printStep("before-down", JSON.stringify(before));

      for (let i = 0; i < 3; i++) {
        await pressKey(send, "ArrowDown");
        await sleep(150);
      }
      const after = await evaluate(editorCaretStateExpr());
      printStep("after-down-x3", JSON.stringify(after));

      assert.equal(after.textboxFocused, true, "Editor textbox must keep focus after pressing Down");
      assert.equal(
        after.listFocusIndex,
        before.listFocusIndex,
        "Down in the editor must not move the review list's focused item"
      );
      assert.ok(
        after.caret > before.caret,
        `Down in the editor must move the caret (caret ${before.caret} -> ${after.caret})`
      );

      // Type, then jump to the end of the list in the same breath: the pending save must stay with its chunk.
      await typeText(send, TYPED_MARKER);
      const jump = await waitForEvalState(
        evaluate,
        () => translateSidebarIconCenterExpr("last-page"),
        (state) => state === "FOUND",
        WAIT_TIMEOUT_MS,
        "Failed to find the sidebar last-page icon"
      );
      await clickAt(send, jump.x, jump.y);
      printStep("jump", "last-page");
      await sleep(SAVE_DEBOUNCE_SETTLE_MS);

      const holders = await evaluate(chunkIdsContainingTextExpr(TYPED_MARKER.trim()));
      assert.equal(holders.state, "OK");
      assert.deepEqual(
        holders.ids,
        [CHUNK_ID],
        `Typed text must be saved in ${CHUNK_ID} only (found in: ${holders.ids.join(", ") || "no chunk"})`
      );
      printStep("typed-text-in", holders.ids.join(", "));

      await waitForEvalExact(
        evaluate,
        clickMenuIconExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Failed to open translate sidebar menu (paper-menu-button#menu)"
      );
      await sleep(1500);
      await waitForEvalExact(
        evaluate,
        clickTranslateSidebarHomeExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Failed to click Home menu item (paper-item[on-tap='gohome'])"
      );
      await sleep(1000);
      await waitForEvalState(
        evaluate,
        () => welcomeHomeVisibleExpr(),
        (state) => state === "VISIBLE",
        WAIT_TIMEOUT_MS,
        "Expected home screen after selecting Home from sidebar menu"
      );
      printStep("welcome-home", "visible");

      console.log("[chunk-edit-keys] PASS: Down moved the caret and the edit stayed in its chunk.");
    });
  });
});
