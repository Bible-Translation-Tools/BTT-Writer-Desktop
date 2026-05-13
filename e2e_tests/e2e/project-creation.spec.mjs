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
        12000,
        "Timed out waiting for project creation interaction."
      );
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

      await waitForEvalResult(
        evaluate,
        clickCenterAddButtonExpr,
        "CLICKED",
        20000,
        "Timed out waiting for project creation interaction."
      );
      printStep("open-resources", "ok");
      await sleep(DIALOG_SETTLE_MS);

      await waitForEvalResult(
        evaluate,
        selectUlbResourceExpr,
        "CLICKED",
        20000,
        "Timed out waiting for project creation interaction."
      );
      printStep("resource-select", "Unlocked Literal Bible");
      await sleep(DIALOG_SETTLE_MS);

      await waitForTextVisible(evaluate, "Confirm", 20000);
      await waitForClick(evaluate, "Confirm");
      printStep("confirm", "ok");
      await sleep(DIALOG_SETTLE_MS);

      await waitForEvalExact(
        evaluate,
        () => firstSourceChunkTextholderContainsExpr("Philemon"),
        "OK",
        20000,
        "Expected first ts-source-chunk #textholder (div) to contain Philemon."
      );
      printStep("source-textholder", "Philemon");

      console.log("[project-creation] PASS: project creation completed.");
    });
  });
});
