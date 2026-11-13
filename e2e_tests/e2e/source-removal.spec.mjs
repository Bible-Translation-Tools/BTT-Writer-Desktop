import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  clickCenterAddButtonExpr,
  selectUlbResourceExpr,
} from "../expressions/project-wizard.mjs";
import {
  clickRemoveLastSourceExpr,
  noSourceModeVisibleExpr,
  recordedErrorsExpr,
  sourceTabVisibleExpr,
} from "../expressions/source-tab.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import {
  sleep,
  waitForClick,
  waitForEvalExact,
  waitForEvalResult,
  waitForTextVisible,
} from "../support/wait.mjs";

const DIALOG_SETTLE_MS = 1200;
const WAIT_TIMEOUT_MS = 5000;
const RELOAD_TIMEOUT_MS = 10000;

function printStep(name, result) {
  console.log(`[source-removal] ${name}: ${result}`);
}

// Runs right after project-creation: the project is open with ULB as its only source.
describe("Source removal", () => {
  test("removes the last source without crashing, then adds it back", async () => {
    await withCdpSession(async ({ evaluate, target }) => {
      printStep("target", `${target.title || "unknown"} (${target.type})`);

      await waitForEvalExact(
        evaluate,
        clickRemoveLastSourceExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Failed to click the remove icon of the only source tab"
      );
      printStep("remove-source", "clicked");

      let noSourceError = null;
      try {
        await waitForEvalExact(
          evaluate,
          noSourceModeVisibleExpr,
          "VISIBLE",
          RELOAD_TIMEOUT_MS,
          "Expected the no-source screen after removing the last source"
        );
      } catch (err) {
        noSourceError = err;
      }

      // Checked first: a renderer crash is the root cause when the no-source screen never shows.
      assert.equal(
        await evaluate(recordedErrorsExpr()),
        "",
        "Removing the last source must not throw in the renderer"
      );
      if (noSourceError) throw noSourceError;
      printStep("no-source-mode", "visible");
      await sleep(DIALOG_SETTLE_MS);

      // Restore the source so the following specs still have a source to work with.
      await waitForEvalResult(
        evaluate,
        clickCenterAddButtonExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Timed out opening the source dialog from the no-source screen."
      );
      printStep("open-resources", "ok");
      await sleep(DIALOG_SETTLE_MS);

      await waitForEvalResult(
        evaluate,
        selectUlbResourceExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Timed out selecting Unlocked Literal Bible."
      );
      printStep("resource-select", "Unlocked Literal Bible");
      await sleep(DIALOG_SETTLE_MS);

      await waitForTextVisible(evaluate, "Confirm", WAIT_TIMEOUT_MS);
      await waitForClick(evaluate, "Confirm", WAIT_TIMEOUT_MS);
      printStep("confirm", "ok");

      await waitForEvalExact(
        evaluate,
        sourceTabVisibleExpr,
        "VISIBLE",
        RELOAD_TIMEOUT_MS,
        "Expected a visible source tab after adding the source back"
      );
      assert.equal(
        await evaluate(recordedErrorsExpr()),
        "",
        "Adding the source back must not throw in the renderer"
      );
      printStep("source-tab", "visible");

      console.log("[source-removal] PASS: last source removed and added back.");
    });
  });
});
