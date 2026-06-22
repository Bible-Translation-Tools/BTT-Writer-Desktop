import { describe, test } from "node:test";
import {
  clickCenterAddButtonExpr,
  clickTopRightNewProjectFabExpr,
  selectUlbResourceExpr,
} from "../expressions/project-wizard.mjs";
import { firstSourceChunkTextholderContainsExpr } from "../expressions/source-chunk.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import {
  sleep,
  waitForBookClickWithScroll,
  waitForClick,
  waitForEvalExact,
  waitForEvalResult,
  waitForTextVisible,
} from "../support/wait.mjs";

const STEP_SETTLE_MS = 700;
const DIALOG_SETTLE_MS = 1200;
const WAIT_TIMEOUT_MS = 5000;

function printStep(name, result) {
  console.log(`[project-creation] ${name}: ${result}`);
}

describe("Project creation", () => {
  test("creates a project through the wizard", async () => {
    await withCdpSession(async ({ evaluate, target }) => {
      printStep("target", `${target.title || "unknown"} (${target.type})`);

      await waitForEvalResult(
        evaluate,
        clickTopRightNewProjectFabExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Timed out waiting for project creation interaction."
      );
      printStep("start-project", "top-right add button");
      await sleep(STEP_SETTLE_MS);

      await waitForTextVisible(evaluate, "Ari", WAIT_TIMEOUT_MS);
      await waitForClick(evaluate, "Ari", WAIT_TIMEOUT_MS);
      printStep("language", "Ari");
      await sleep(STEP_SETTLE_MS);

      await waitForTextVisible(evaluate, "New Testament", WAIT_TIMEOUT_MS);
      await waitForClick(evaluate, "New Testament", WAIT_TIMEOUT_MS);
      printStep("testament", "New Testament");
      await sleep(STEP_SETTLE_MS);

      await waitForBookClickWithScroll(evaluate, "Philemon", WAIT_TIMEOUT_MS);
      printStep("book", "Philemon");
      await sleep(DIALOG_SETTLE_MS);

      await waitForEvalResult(
        evaluate,
        clickCenterAddButtonExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Timed out waiting for project creation interaction."
      );
      printStep("open-resources", "ok");
      await sleep(DIALOG_SETTLE_MS);

      await waitForEvalResult(
        evaluate,
        selectUlbResourceExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Timed out waiting for project creation interaction."
      );
      printStep("resource-select", "Unlocked Literal Bible");
      await sleep(DIALOG_SETTLE_MS);

      await waitForTextVisible(evaluate, "Confirm", WAIT_TIMEOUT_MS);
      await waitForClick(evaluate, "Confirm", WAIT_TIMEOUT_MS);
      printStep("confirm", "ok");
      await sleep(DIALOG_SETTLE_MS);

      await waitForEvalExact(
        evaluate,
        () => firstSourceChunkTextholderContainsExpr("Philemon"),
        "OK",
        WAIT_TIMEOUT_MS,
        "Expected first ts-source-chunk #textholder (div) to contain Philemon."
      );
      printStep("source-textholder", "Philemon");

      console.log("[project-creation] PASS: project creation completed.");
    });
  });
});
